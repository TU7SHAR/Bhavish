import { createClient } from "@supabase/supabase-js";
import { generateFullReport } from "./report-generation.js";
import { getInternalAuthHeaders } from "./auth.js";
import { resolvePlan, resolveLegacyBump } from "./plans.js";
import { classifyFocus } from "./deep-dive.js";

/**
 * Server-side payment fulfilment — THE SINGLE ORCHESTRATOR.
 *
 * Called by:
 *  - /api/razorpay-webhook (server-to-server from Razorpay)
 *  - /api/admin/reconcile-payments (manual recovery)
 *
 * ARCHITECTURE:
 *  - This function MARKS PAID, then CLAIMS generation via the atomic RPC.
 *  - If the browser already generated (report_status=completed), this function
 *    still ensures EMAIL DELIVERY + OWNER NOTIFICATION happen.
 *  - For Master: if deep_dive_status != completed, retries the deep-dive trigger.
 *  - NEVER skips email just because report_status is completed.
 *
 * IDEMPOTENT: Safe to call multiple times for the same order.
 */
export async function fulfillPayment({ reportId, paymentId, planId, includeGuidance, includeBump = false, source = "server" }) {
  if (!reportId) return { status: "error", reportId, detail: "missing reportId" };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // 1. Load the lead row
  const { data: report, error: fetchErr } = await supabase
    .from("reports")
    .select("*")
    .eq("report_id", reportId)
    .single();

  if (fetchErr || !report) {
    console.error(`[fulfill:${source}] report ${reportId} not found:`, fetchErr?.message);
    return { status: "not_found", reportId };
  }

  // 2. Resolve plan
  let plan = planId ? resolvePlan(planId, { includeGuidance: !!includeGuidance }) : null;
  if (!plan && ["essential", "premium", "master"].includes(report.plan_tier)) {
    plan = resolvePlan(report.plan_tier, { includeGuidance: (report.guidance_months || 0) > 0 });
  }
  if (!plan) {
    plan = resolveLegacyBump(!!includeBump || !!report.has_12_month_guidance);
  }
  const guidanceOn = (plan.guidanceMonths || 0) > 0 || !!report.has_12_month_guidance;
  const isMaster = !!plan.deepDive;

  // 3. Mark PAID (most important step — never lose the money record).
  //    NOTE: Does NOT set report_status here. The atomic claim RPC handles that.
  const alreadyPaid = report.payment_status === "paid";
  if (!alreadyPaid) {
    const now = new Date();
    const guidanceEnd = new Date(now);
    guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

    const paidFields = {
      payment_status: "paid",
      payment_id: paymentId || report.payment_id || null,
      // DO NOT set report_status here — let claim_report_generation() own it.
      has_12_month_guidance: guidanceOn,
      guidance_start_date: guidanceOn ? report.guidance_start_date || now.toISOString() : report.guidance_start_date || null,
      guidance_end_date: guidanceOn ? report.guidance_end_date || guidanceEnd.toISOString() : report.guidance_end_date || null,
      plan_tier: report.plan_tier || plan.tier,
      plan_price: report.plan_price || plan.price,
      guidance_months: guidanceOn ? 12 : 0,
    };
    if (isMaster) {
      paidFields.deep_dive_status = report.deep_dive_status && report.deep_dive_status !== "none" ? report.deep_dive_status : "pending";
      paidFields.deep_dive_focus = report.deep_dive_focus || classifyFocus(report.personal_question);
    } else if (!report.deep_dive_status) {
      paidFields.deep_dive_status = "none";
    }

    let markErr = (await supabase.from("reports").update({ ...paidFields, paid_at: new Date().toISOString() }).eq("report_id", reportId)).error;
    if (markErr) {
      const { plan_tier, plan_price, guidance_months, deep_dive_status, deep_dive_focus, ...legacy } = paidFields;
      markErr = (await supabase.from("reports").update({ ...legacy, paid_at: new Date().toISOString() }).eq("report_id", reportId)).error;
      if (markErr) {
        markErr = (await supabase.from("reports").update(legacy).eq("report_id", reportId)).error;
      }
    }
    if (markErr) {
      console.error(`[fulfill:${source}] failed to mark ${reportId} paid:`, markErr.message);
      return { status: "mark_paid_failed", reportId, detail: markErr.message };
    }
  }

  // 4. Check current state AFTER marking paid (re-read for freshness).
  const { data: fresh } = await supabase
    .from("reports")
    .select("report_status, email_sent_at, deep_dive_status, sections, chart_data")
    .eq("report_id", reportId)
    .single();

  const reportCompleted = fresh?.report_status === "completed" && Array.isArray(fresh?.sections) && fresh.sections.length > 5;
  const emailAlreadySent = !!fresh?.email_sent_at;
  const chartData = fresh?.chart_data || report.chart_data;

  // 5. If report already complete (browser generated it), ensure delivery.
  if (reportCompleted) {
    // Ensure email was sent (browser no longer sends email).
    if (!emailAlreadySent && report.email && report.email.trim()) {
      if (!isMaster || fresh?.deep_dive_status === "completed") {
        const sent = await sendReportEmail({ report, generated: { summary: report.summary, sections: fresh.sections }, guidanceOn });
        if (sent) await supabase.from("reports").update({ email_sent_at: new Date().toISOString() }).eq("report_id", reportId);
      }
    }
    // Master: ensure deep-dive is triggered if still pending.
    if (isMaster && fresh?.deep_dive_status !== "completed" && fresh?.deep_dive_status !== "generating") {
      triggerDeepDive(reportId);
    }
    await notifyOwner(report, paymentId, plan, true);
    return { status: "already_done", reportId, delivered: true };
  }

  // 6. No chart data → can't generate.
  if (!chartData) {
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
    await notifyOwner(report, paymentId, plan, false);
    return { status: "paid_no_chartdata", reportId, delivered: false };
  }

  // 7. Claim generation via atomic RPC (handles NULL, stale locks, concurrency).
  let claimed = false;
  const { data: claimData, error: claimErr } = await supabase.rpc("claim_report_generation", { p_report_id: reportId });
  if (claimErr) {
    // RPC not available (migration not run). Fallback: re-read and decide.
    const { data: checkRow } = await supabase.from("reports").select("report_status").eq("report_id", reportId).single();
    if (checkRow?.report_status === "generating" || checkRow?.report_status === "completed") {
      // Someone else owns it or it's done. Ensure email delivery.
      if (checkRow?.report_status === "completed") {
        if (!emailAlreadySent && report.email) {
          const { data: fullRow } = await supabase.from("reports").select("summary, sections").eq("report_id", reportId).single();
          if (fullRow) {
            const sent = await sendReportEmail({ report, generated: fullRow, guidanceOn });
            if (sent) await supabase.from("reports").update({ email_sent_at: new Date().toISOString() }).eq("report_id", reportId);
          }
        }
      }
      await notifyOwner(report, paymentId, plan, checkRow?.report_status === "completed");
      return { status: "already_generating", reportId };
    }
    // Try raw claim
    const { data: rows } = await supabase
      .from("reports").update({ report_status: "generating" })
      .eq("report_id", reportId)
      .not("report_status", "in", '("generating","completed")')
      .select("report_id");
    claimed = Array.isArray(rows) && rows.length > 0;
  } else {
    claimed = !!claimData;
  }

  if (!claimed) {
    await notifyOwner(report, paymentId, plan, false);
    return { status: "already_generating", reportId };
  }

  // 8. Generate the report.
  let delivered = false;
  try {
    const generated = await generateFullReport({
      name: report.name,
      gender: report.gender,
      dateOfBirth: report.date_of_birth,
      timeOfBirth: report.time_of_birth,
      placeOfBirth: report.place_of_birth,
      chartData,
      personalQuestion: report.personal_question || "",
      tier: plan.tier,
      guidanceMonths: plan.guidanceMonths,
    });

    await supabase.from("reports").update({
      summary: generated.summary,
      sections: generated.sections,
      report_status: "completed",
    }).eq("report_id", reportId);

    // 9. Email — Essential/Premium: immediately. Master: held for deep-dive.
    if (report.email && report.email.trim() && !isMaster) {
      const sent = await sendReportEmail({ report, generated, guidanceOn });
      if (sent) await supabase.from("reports").update({ email_sent_at: new Date().toISOString() }).eq("report_id", reportId);
    }

    // 10. Master: trigger deep-dive (deep-dive endpoint sends the final email).
    if (isMaster) {
      triggerDeepDive(reportId);
    }

    delivered = true;
  } catch (genErr) {
    console.error(`[fulfill:${source}] generation failed for ${reportId}:`, genErr.message);
    await supabase.from("reports").update({ report_status: "failed" }).eq("report_id", reportId);
  }

  await notifyOwner(report, paymentId, plan, delivered);
  return { status: "fulfilled", reportId, delivered, tier: plan.tier };
}

// --- helpers ---

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
}

function triggerDeepDive(reportId) {
  fetch(`${baseUrl()}/api/generate-master-deep-dive`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reportId }),
  }).catch((e) => console.error("[fulfill] deep-dive trigger failed:", e.message));
}

async function sendReportEmail({ report, generated, guidanceOn }) {
  try {
    const res = await fetch(`${baseUrl()}/api/send-report-email`, {
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
    return res.ok; // true = email sent, false = failed
  } catch (e) {
    console.error("[fulfill] report email failed:", e.message);
    return false;
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
