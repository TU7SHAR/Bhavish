import { createClient } from "@supabase/supabase-js";
import { generateFullReport } from "./report-generation.js";
import { getInternalAuthHeaders } from "./auth.js";
import { resolvePlan, resolveLegacyBump } from "./plans.js";
import { classifyFocus } from "./deep-dive.js";

/**
 * Server-side payment fulfilment — the SAFETY NET for when the browser-side
 * Razorpay callback never fires (very common with UPI: the user pays in their
 * UPI app and never returns to the tab, so verify-payment / generate-full-report
 * / send-report-email are never called and the customer shows as "unpaid").
 *
 * Called by:
 *  - /api/razorpay-webhook       (automatic, server-to-server from Razorpay)
 *  - /api/admin/reconcile-payments (manual recovery / cross-check with Razorpay)
 *
 * It is IDEMPOTENT: safe to call multiple times for the same order.
 *
 * @param {Object} args
 * @param {string} args.reportId       Public report id (order receipt / notes.reportId)
 * @param {string} args.paymentId      Razorpay payment id
 * @param {string} [args.planId]       "essential" | "premium" | "master" (from order notes)
 * @param {boolean} [args.includeGuidance] Essential guidance add-on flag (from order notes)
 * @param {boolean} [args.includeBump] Legacy guidance flag (older orders)
 * @param {string} [args.source]       Label for logging (e.g. "webhook", "reconcile")
 */
export async function fulfillPayment({ reportId, paymentId, planId, includeGuidance, includeBump = false, source = "server" }) {
  if (!reportId) return { status: "error", reportId, detail: "missing reportId" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // 1. Load the lead row (created at preview time, holds chart_data + birth details)
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("*")
    .eq("report_id", reportId)
    .single();

  if (fetchErr || !report) {
    console.error(`[fulfill:${source}] report ${reportId} not found:`, fetchErr?.message);
    return { status: "not_found", reportId };
  }

  // 2. Idempotency — if already fully done, do nothing.
  const alreadyPaid = report.payment_status === "paid";
  const alreadyDelivered = report.report_status === "completed";
  if (alreadyPaid && alreadyDelivered) {
    return { status: "already_done", reportId };
  }

  // 2b. Resolve the plan. Prefer the explicit planId from the order notes; else
  //     the tier already stored on the row (browser verify-payment may have run
  //     first); else fall back to the legacy single-report + optional bump.
  let plan = planId ? resolvePlan(planId, { includeGuidance: !!includeGuidance }) : null;
  if (!plan && ["essential", "premium", "master"].includes(report.plan_tier)) {
    plan = resolvePlan(report.plan_tier, { includeGuidance: (report.guidance_months || 0) > 0 });
  }
  if (!plan) {
    plan = resolveLegacyBump(!!includeBump || !!report.has_12_month_guidance);
  }
  const guidanceOn = (plan.guidanceMonths || 0) > 0 || !!report.has_12_month_guidance;

  // 3. Mark PAID immediately (never lose the money record). .update() not upsert.
  const now = new Date();
  const guidanceEnd = new Date(now);
  guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

  const paidFields = {
    payment_status: "paid",
    payment_id: paymentId || report.payment_id || null,
    report_status: "generating",
    // Legacy guidance fields (kept in sync).
    has_12_month_guidance: guidanceOn,
    guidance_start_date: guidanceOn ? report.guidance_start_date || now.toISOString() : report.guidance_start_date || null,
    guidance_end_date: guidanceOn ? report.guidance_end_date || guidanceEnd.toISOString() : report.guidance_end_date || null,
    // New plan metadata (don't downgrade values verify-payment may have set).
    plan_tier: report.plan_tier || plan.tier,
    plan_price: report.plan_price || plan.price,
    guidance_months: guidanceOn ? 12 : 0,
  };
  if (plan.deepDive) {
    paidFields.deep_dive_status =
      report.deep_dive_status && report.deep_dive_status !== "none" ? report.deep_dive_status : "pending";
    paidFields.deep_dive_focus = report.deep_dive_focus || classifyFocus(report.personal_question);
  } else if (!report.deep_dive_status) {
    paidFields.deep_dive_status = "none";
  }

  // Progressive fallback if newer columns don't exist yet.
  let markErr = (
    await supabase.from("reports").update({ ...paidFields, paid_at: now.toISOString() }).eq("report_id", reportId)
  ).error;
  if (markErr) {
    const { plan_tier, plan_price, guidance_months, deep_dive_status, deep_dive_focus, ...legacy } = paidFields;
    markErr = (
      await supabase.from("reports").update({ ...legacy, paid_at: now.toISOString() }).eq("report_id", reportId)
    ).error;
    if (markErr) {
      markErr = (await supabase.from("reports").update(legacy).eq("report_id", reportId)).error;
    }
  }
  if (markErr) {
    console.error(`[fulfill:${source}] failed to mark ${reportId} paid:`, markErr.message);
    return { status: "mark_paid_failed", reportId, detail: markErr.message };
  }

  // 4. Generate the full report from the stored chart_data (if we have it).
  const chartData = report.chart_data;
  let delivered = false;

  if (!chartData) {
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
    await notifyOwner(report, paymentId, plan, false);
    return { status: "paid_no_chartdata", reportId, delivered: false };
  }

  try {
    const generated = await generateFullReport({
      name: report.name,
      gender: report.gender,
      dateOfBirth: report.date_of_birth,
      timeOfBirth: report.time_of_birth,
      placeOfBirth: report.place_of_birth,
      chartData,
      personalQuestion: report.personal_question || "",
      tier: plan.tier, // "master" is generated as a 20-section premium main report
      guidanceMonths: plan.guidanceMonths,
    });

    // 5. Save the generated main report.
    await supabase
      .from("reports")
      .update({
        summary: generated.summary,
        sections: generated.sections,
        report_status: "completed",
      })
      .eq("report_id", reportId);

    // 6. Email the report to the customer (best-effort).
    if (report.email && report.email.trim()) {
      await sendReportEmail({ report, generated, guidanceOn });
    }

    // 7. Master tier: trigger the concern-specific deep-dive as a SEPARATE job
    //    (its own serverless invocation) so we never run two Gemini calls in
    //    one request. Idempotent + retried by the client and reconciliation.
    if (plan.deepDive) {
      triggerDeepDive(reportId);
    }

    delivered = true;
  } catch (genErr) {
    console.error(`[fulfill:${source}] generation failed for ${reportId}:`, genErr.message);
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
  }

  // 8. Notify the owner about the sale.
  await notifyOwner(report, paymentId, plan, delivered);

  return { status: "fulfilled", reportId, delivered, tier: plan.tier };
}

// --- helpers (server-to-server calls reuse existing, tested routes) ---

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
}

// Fire-and-forget trigger for the Master deep-dive (separate serverless job).
function triggerDeepDive(reportId) {
  try {
    fetch(`${baseUrl()}/api/generate-master-deep-dive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId }),
    }).catch((e) => console.error("[fulfill] deep-dive trigger failed:", e.message));
  } catch (e) {
    console.error("[fulfill] deep-dive trigger error:", e.message);
  }
}

async function sendReportEmail({ report, generated, guidanceOn }) {
  try {
    await fetch(`${baseUrl()}/api/send-report-email`, {
      method: "POST",
      headers: getInternalAuthHeaders(),
      body: JSON.stringify({
        email: report.email,
        name: report.name,
        reportId: report.report_id,
        sections: generated.sections,
        summary: generated.summary,
        chartData: report.chart_data,
        dateOfBirth: report.date_of_birth,
        timeOfBirth: report.time_of_birth,
        placeOfBirth: report.place_of_birth,
        includeBump: guidanceOn,
      }),
    });
  } catch (e) {
    console.error("[fulfill] report email failed:", e.message);
  }
}

async function notifyOwner(report, paymentId, plan, reportComplete) {
  try {
    await fetch(`${baseUrl()}/api/notify-sale`, {
      method: "POST",
      headers: getInternalAuthHeaders(),
      body: JSON.stringify({
        reportId: report.report_id,
        customerName: report.name,
        customerEmail: report.email,
        paymentId,
        amount: String(plan?.price || 299),
        planTier: plan?.tier || "premium",
        placeOfBirth: report.place_of_birth,
        dateOfBirth: report.date_of_birth,
        includeBump: (plan?.guidanceMonths || 0) > 0,
        reportComplete,
      }),
    });
  } catch (e) {
    console.error("[fulfill] owner notification failed:", e.message);
  }
}
