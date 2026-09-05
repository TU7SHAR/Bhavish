import Razorpay from "razorpay";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyCron } from "../../../../lib/auth.js";
import { fulfillPayment } from "../../../../lib/fulfill-payment.js";

// AUTO-RECONCILIATION CRON — the self-healing safety net for missed payments.
//
// WHY THIS EXISTS:
//   A payment can be captured by Razorpay but never recorded as "paid" in our
//   DB when BOTH of the primary paths miss it:
//     1. The browser callback (/api/verify-payment) never fires — common with
//        UPI, where the user pays inside their UPI app and never returns to the
//        browser tab.
//     2. The Razorpay webhook (/api/razorpay-webhook) is misconfigured, its
//        secret is missing/placeholder, or a delivery is dropped.
//   When that happens the customer paid but got nothing, and the sale is
//   invisible in the admin dashboard.
//
//   This cron scans recent captured Razorpay payments on a schedule and calls
//   the SAME idempotent fulfillPayment() orchestrator the manual admin
//   reconcile uses. Anything already fulfilled is a no-op; anything missed is
//   marked paid, generated, and emailed automatically.
//
// SCHEDULE: vercel.json runs this ONCE DAILY (Vercel Hobby only permits daily
//   crons — an hourly "0 * * * *" is rejected at deploy time). For faster
//   recovery, trigger this endpoint HOURLY from an external scheduler such as
//   cron-job.org (which supports sub-hourly schedules + the Authorization
//   header). See docs/cron-setup.md. The endpoint is idempotent, so any number
//   of triggers is safe — nothing is lost between runs.
// AUTH: CRON_SECRET (caller sends Authorization: Bearer <CRON_SECRET>).
//
// GET /api/cron/reconcile-payments
//   ?count=50   how many recent captured payments to scan (default 30, max 100)
export const maxDuration = 60;

export async function GET(request) {
  const auth = verifyCron(request);
  if (!auth.authorized) return auth.error;

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ ok: false, reason: "razorpay_not_configured" }, { status: 200 });
  }

  const { searchParams } = new URL(request.url);
  // Default raised from 30 -> 100 because this now runs ONCE per day (Vercel
  // Hobby cron limit), so a single run must cover a full day of payments.
  // Still idempotent + capped at 100. Override with ?count= for manual runs.
  const count = Math.min(Math.max(parseInt(searchParams.get("count") || "100", 10) || 100, 1), 100);

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const list = await razorpay.payments.all({ count });
    const items = Array.isArray(list?.items) ? list.items : [];
    const captured = items.filter((p) => p.status === "captured");

    const results = [];
    for (const payment of captured) {
      const details = await orderDetailsFromPayment(razorpay, payment);
      if (!details.reportId) {
        results.push({ paymentId: payment.id, status: "no_report_id" });
        continue;
      }
      const result = await fulfillPayment({
        reportId: details.reportId,
        paymentId: payment.id,
        planId: details.planId,
        includeGuidance: details.includeGuidance,
        includeBump: details.includeBump,
        source: "cron-reconcile",
      });
      results.push({ paymentId: payment.id, ...result });
    }

    // ── DB SWEEP (the permanent-fallthrough safety net) ──────────────────
    // The Razorpay-list scan above only covers the most recent `count`
    // payments. A row can be marked payment_status='paid' but have its report
    // generation FAIL or get STUCK ('failed', or 'generating' with a dead
    // process) — and once that payment scrolls out of the recent window, the
    // list scan never revisits it, so the customer paid but stays undelivered
    // FOREVER. This sweep is independent of the Razorpay time window: it finds
    // paid-but-undelivered rows directly in the DB and re-runs the SAME
    // idempotent fulfillPayment() on them. claim_report_generation() re-claims
    // 'failed' and stale-'generating' rows, so this genuinely recovers them.
    const sweep = await sweepStuckPaidRows();

    const summary = {
      scanned: items.length,
      captured: captured.length,
      // "fulfilled" = a payment that was actually MISSED and just got recovered.
      fulfilled: results.filter((r) => r.status === "fulfilled").length,
      alreadyDone: results.filter((r) => r.status === "already_done").length,
      notFound: results.filter((r) => r.status === "not_found").length,
      failed: results.filter((r) =>
        ["mark_paid_failed", "paid_no_chartdata", "no_report_id", "error"].includes(r.status)
      ).length,
      sweep,
    };

    // Only log the noteworthy cases (an actual recovery) to keep cron logs quiet.
    if (summary.fulfilled > 0 || sweep.recovered > 0) {
      console.log(
        `[cron-reconcile] recovered ${summary.fulfilled} missed payment(s) + ${sweep.recovered} stuck paid row(s):`,
        summary
      );
    }

    return NextResponse.json({ ok: true, summary, results });
  } catch (error) {
    console.error("[cron-reconcile] error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// DB SWEEP: find rows that are PAID but not actually delivered, and re-run
// fulfillPayment() on each. Independent of the Razorpay recent-payments window,
// so a stuck row is recovered no matter how old it is. Idempotent + bounded.
//
// "Undelivered" = paid, but the report isn't a completed real report:
//   report_status is 'failed', or NULL, or 'generating' but stale (>10 min),
//   OR there are no/too-few sections.
async function sweepStuckPaidRows() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Pull paid rows that are NOT cleanly completed. Cap the batch so a single
    // daily cron run can never blow the function timeout (Gemini generation is
    // slow). Oldest first so the longest-waiting customer is served first.
    const staleGeneratingCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: rows, error } = await supabase
      .from("reports")
      .select("report_id, plan_tier, guidance_months, has_12_month_guidance, report_status, generation_started_at, sections")
      .eq("payment_status", "paid")
      .or(`report_status.is.null,report_status.eq.failed,report_status.eq.generating`)
      .order("paid_at", { ascending: true })
      .limit(50);

    if (error) {
      // Column/query issue — never fail the whole cron over the sweep.
      return { attempted: 0, recovered: 0, skipped: 0, note: error.message };
    }

    // Filter in code: a 'generating' row only counts as stuck if it's been that
    // way for >10 min (a live generation in progress must be left alone).
    const candidates = (rows || []).filter((r) => {
      const completedEnough = r.report_status === "completed" && Array.isArray(r.sections) && r.sections.length > 5;
      if (completedEnough) return false;
      if (r.report_status === "generating") {
        return r.generation_started_at && r.generation_started_at < staleGeneratingCutoff;
      }
      return true; // null or 'failed'
    });

    let recovered = 0;
    let skipped = 0;
    for (const r of candidates) {
      const includeGuidance = (r.guidance_months || 0) > 0 || r.has_12_month_guidance === true;
      const result = await fulfillPayment({
        reportId: r.report_id,
        planId: r.plan_tier || null,
        includeGuidance,
        includeBump: r.has_12_month_guidance === true,
        source: "cron-sweep",
      });
      if (result.status === "fulfilled" && result.delivered) recovered++;
      else skipped++;
    }

    return { attempted: candidates.length, recovered, skipped };
  } catch (e) {
    return { attempted: 0, recovered: 0, skipped: 0, note: e.message };
  }
}

// Resolve { reportId, planId, includeGuidance, includeBump } for a payment by
// reading its parent order notes. Mirrors the logic in the admin reconcile
// route so both recovery paths behave identically.
function planFromNotes(notes = {}, amount) {
  return {
    planId: notes.planId || null,
    includeGuidance: notes.guidanceMonths
      ? parseInt(notes.guidanceMonths, 10) > 0
      : notes.has_12_month_guidance === "true" || amount === 44800,
    // Legacy add-on flag (₹448 = base + guidance).
    includeBump: notes.has_12_month_guidance === "true" || amount === 44800,
  };
}

async function orderDetailsFromPayment(razorpay, payment) {
  // Payment notes may carry it directly.
  if (payment?.notes?.reportId) {
    return {
      reportId: payment.notes.reportId,
      ...planFromNotes(payment.notes, payment.amount),
    };
  }
  if (payment?.order_id) {
    try {
      const order = await razorpay.orders.fetch(payment.order_id);
      const notes = order?.notes || {};
      return {
        reportId: notes.reportId || order?.receipt || null,
        ...planFromNotes(notes, payment.amount),
      };
    } catch (e) {
      console.error("[cron-reconcile] order fetch failed", payment.order_id, e.message);
    }
  }
  return { reportId: null, planId: null, includeGuidance: false, includeBump: false };
}
