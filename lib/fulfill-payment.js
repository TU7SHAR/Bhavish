import { createClient } from "@supabase/supabase-js";
import { generateFullReport } from "./report-generation.js";
import { getInternalAuthHeaders } from "./auth.js";

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
 * It is IDEMPOTENT: safe to call multiple times for the same order (webhook
 * retries, reconciliation runs, and the browser flow can all overlap without
 * double-charging, double-generating, or double-emailing).
 *
 * @param {Object} args
 * @param {string} args.reportId    Public report id (order receipt / notes.reportId)
 * @param {string} args.paymentId   Razorpay payment id
 * @param {boolean} args.includeBump Whether the ₹149 12-month guidance add-on was bought
 * @param {string} [args.source]    Label for logging (e.g. "webhook", "reconcile")
 * @returns {Promise<{status: string, reportId: string, delivered?: boolean, detail?: string}>}
 */
export async function fulfillPayment({ reportId, paymentId, includeBump = false, source = "server" }) {
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

  // 3. Mark PAID immediately (the most important step — never lose the money record).
  //    Uses .update() (not upsert) so we never wipe attribution / chart_data / etc.
  const now = new Date();
  const guidanceEnd = new Date(now);
  guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

  const paidFields = {
    payment_status: "paid",
    payment_id: paymentId || report.payment_id || null,
    has_12_month_guidance: !!includeBump || !!report.has_12_month_guidance,
    guidance_start_date: includeBump ? now.toISOString() : report.guidance_start_date || null,
    guidance_end_date: includeBump ? guidanceEnd.toISOString() : report.guidance_end_date || null,
    report_status: "generating",
  };

  // Try with paid_at (newer column); fall back gracefully if it doesn't exist.
  let markErr = (
    await supabase.from("reports").update({ ...paidFields, paid_at: now.toISOString() }).eq("report_id", reportId)
  ).error;
  if (markErr) {
    markErr = (await supabase.from("reports").update(paidFields).eq("report_id", reportId)).error;
  }
  if (markErr) {
    console.error(`[fulfill:${source}] failed to mark ${reportId} paid:`, markErr.message);
    return { status: "mark_paid_failed", reportId, detail: markErr.message };
  }

  const effectiveBump = !!includeBump || !!report.has_12_month_guidance;

  // 4. Generate the full report from the stored chart_data (if we have it).
  const chartData = report.chart_data;
  let delivered = false;

  if (!chartData) {
    // Payment is safely recorded, but we can't auto-generate without chart data.
    // Flag for manual regeneration and alert the owner.
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
    await notifyOwner(report, paymentId, effectiveBump, false);
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
      includeBump: effectiveBump,
    });

    // 5. Save the generated report.
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
      await sendReportEmail({ report, generated, includeBump: effectiveBump });
    }
    delivered = true;
  } catch (genErr) {
    console.error(`[fulfill:${source}] generation failed for ${reportId}:`, genErr.message);
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
  }

  // 7. Notify the owner about the sale (flag if the report failed so they can regenerate).
  await notifyOwner(report, paymentId, effectiveBump, delivered);

  return { status: "fulfilled", reportId, delivered };
}

// --- helpers (server-to-server calls reuse existing, tested routes) ---

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
}

async function sendReportEmail({ report, generated, includeBump }) {
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
        includeBump,
      }),
    });
  } catch (e) {
    console.error("[fulfill] report email failed:", e.message);
  }
}

async function notifyOwner(report, paymentId, includeBump, reportComplete) {
  try {
    await fetch(`${baseUrl()}/api/notify-sale`, {
      method: "POST",
      headers: getInternalAuthHeaders(),
      body: JSON.stringify({
        reportId: report.report_id,
        customerName: report.name,
        customerEmail: report.email,
        paymentId,
        amount: includeBump ? "448" : "299",
        placeOfBirth: report.place_of_birth,
        dateOfBirth: report.date_of_birth,
        includeBump,
        reportComplete,
      }),
    });
  } catch (e) {
    console.error("[fulfill] owner notification failed:", e.message);
  }
}
