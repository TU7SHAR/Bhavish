import Razorpay from "razorpay";
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
// SCHEDULE: wired in vercel.json (hourly). Nothing is lost between runs.
// AUTH: CRON_SECRET (Vercel Cron sends Authorization: Bearer <CRON_SECRET>).
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
    };

    // Only log the noteworthy case (an actual recovery) to keep cron logs quiet.
    if (summary.fulfilled > 0) {
      console.log(`[cron-reconcile] recovered ${summary.fulfilled} missed payment(s):`, summary);
    }

    return NextResponse.json({ ok: true, summary, results });
  } catch (error) {
    console.error("[cron-reconcile] error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
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
