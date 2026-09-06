import { createClient } from "@supabase/supabase-js";
import { generateFullReport } from "./report-generation.js";
import { getInternalAuthHeaders } from "./auth.js";
import { resolvePlan, resolveLegacyBump } from "./plans.js";
import { classifyFocus } from "./deep-dive.js";
import { sendPurchaseEvent } from "./meta-capi.js";

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

  // 3b. Fire the Meta Conversions API Purchase event (server-side), ONCE per
  //     report. This is the reliable Purchase signal — it runs for webhook and
  //     reconciled UPI payments the browser Pixel misses. Deduped with the
  //     browser Pixel via a shared event_id (purchase_<reportId>), and guarded
  //     by meta_purchase_sent_at so retries/multiple paths never double-fire.
  //     Fail-soft: never blocks fulfilment.
  await maybeSendMetaPurchase(supabase, report, plan);

  // 4. Check current state AFTER marking paid (re-read for freshness).
  const { data: fresh } = await supabase
    .from("reports")
    .select("report_status, email_sent_at, deep_dive_status, sections, chart_data")
    .eq("report_id", reportId)
    .single();

  const reportCompleted = fresh?.report_status === "completed" && Array.isArray(fresh?.sections) && fresh.sections.length > 5;
  const chartData = fresh?.chart_data || report.chart_data;

  // 5. If report already complete (browser generated it), ensure delivery via
  //    the single race-safe orchestrator (atomic email claim inside).
  if (reportCompleted) {
    if (!isMaster) {
      await deliverReport(supabase, deliveryRow(report, plan), { summary: report.summary, sections: fresh.sections });
    } else {
      // Master: deep-dive endpoint owns the final email; ensure it's triggered.
      if (fresh?.deep_dive_status !== "completed" && fresh?.deep_dive_status !== "generating") {
        triggerDeepDive(reportId);
      }
      await notifyOwner(report, paymentId, plan, true);
    }
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
      // Someone else owns it or it's done. Ensure delivery (race-safe).
      if (checkRow?.report_status === "completed" && !isMaster) {
        const { data: fullRow } = await supabase.from("reports").select("summary, sections").eq("report_id", reportId).single();
        if (fullRow) {
          await deliverReport(supabase, deliveryRow(report, plan), fullRow);
        }
      } else {
        await notifyOwner(report, paymentId, plan, checkRow?.report_status === "completed");
      }
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

    // 9. Deliver — Essential/Premium: now (race-safe single orchestrator).
    //    Master: held for the deep-dive endpoint.
    if (!isMaster) {
      await deliverReport(supabase, deliveryRow(report, plan), generated);
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

  // Owner notification: for non-Master success, deliverReport() already
  // notified as part of the atomic delivery. Notify here only for Master
  // (deliverReport skips Master) or when generation did NOT succeed.
  if (isMaster || !delivered) {
    await notifyOwner(report, paymentId, plan, delivered);
  }
  return { status: "fulfilled", reportId, delivered, tier: plan.tier };
}

// --- helpers ---

function baseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
}

// Build the row shape deliverReport() expects (it reads plan_tier/plan_price/
// guidance_months off the row). Merges the resolved plan onto the DB row so
// legacy rows with null plan fields still deliver with correct tier/price.
function deliveryRow(report, plan) {
  return {
    ...report,
    plan_tier: report.plan_tier || plan?.tier || "premium",
    plan_price: report.plan_price || plan?.price || 299,
    guidance_months: report.guidance_months ?? (plan?.guidanceMonths || 0),
  };
}

// Fire the Meta CAPI Purchase event once per report. Guarded by the
// meta_purchase_sent_at column so retries / multiple fulfilment paths
// (webhook + reconcile) never double-report. Deduped with the browser Pixel
// via the shared event_id in sendPurchaseEvent(). Fully fail-soft.
async function maybeSendMetaPurchase(supabase, report, plan) {
  try {
    if (report?.meta_purchase_sent_at) return; // already reported

    const value = (report?.plan_price && typeof report.plan_price === "number")
      ? report.plan_price
      : (plan?.price || 299);

    const result = await sendPurchaseEvent({
      reportId: report.report_id,
      value,
      currency: "INR",
      email: report.email,
      planTier: report.plan_tier || plan?.tier || "premium",
      eventSourceUrl: `${baseUrl()}/report/preview`,
    });

    // Only stamp the flag when we actually sent (or intentionally skipped
    // because CAPI isn't configured — no point retrying every time then).
    if (result?.sent || result?.skipped === "not_configured") {
      await supabase
        .from("reports")
        .update({ meta_purchase_sent_at: new Date().toISOString() })
        .eq("report_id", report.report_id);
    }
  } catch (e) {
    // Column may not exist yet (migration not run) or network blip — never
    // let this affect fulfilment.
    console.warn("[fulfill] meta purchase event skipped:", e.message);
  }
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
    // IDEMPOTENCY: only send the "New Sale" owner email ONCE per report, ever.
    // Previously this fired on every fulfillPayment() call — so a reconcile
    // pass over already-completed paid rows re-spammed the owner with "New
    // Sale!" emails for OLD sales. We now atomically claim owner_notified_at
    // (UPDATE ... WHERE owner_notified_at IS NULL): only the first call wins
    // and sends; every later call (reconcile, sweep, retries) sees 0 rows and
    // skips. Same pattern as the customer-email claim in deliverReport().
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const claimStamp = new Date().toISOString();
    const { data: claimedRows, error: claimErr } = await supabase
      .from("reports")
      .update({ owner_notified_at: claimStamp })
      .eq("report_id", report.report_id)
      .is("owner_notified_at", null)
      .select("report_id");

    // If the column doesn't exist yet (migration not run), claimErr is set.
    // Fail SAFE toward NOT spamming: if we can't confirm the claim, skip
    // sending for reconcile-style re-runs. A brand-new sale still notifies
    // because owner_notified_at starts null and the first claim succeeds once
    // the migration is applied. Until then, we suppress duplicates by only
    // sending when the claim clearly succeeds.
    if (claimErr) {
      // Column missing → we can't dedupe. To honor "no emails for old sales",
      // suppress here and rely on the browser/webhook first-fulfilment path.
      // (Run migration 007 to restore first-sale owner emails via the claim.)
      console.warn("[fulfill] owner_notified_at claim failed (run migration 007?):", claimErr.message);
      return;
    }

    const claimed = Array.isArray(claimedRows) && claimedRows.length > 0;
    if (!claimed) return; // already notified for this report — do not re-send

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

/**
 * THE SINGLE DELIVERY PATH for a completed (non-Master) report: customer email
 * + owner notification. Both the browser route (/api/generate-full-report) and
 * fulfillPayment() call this instead of each duplicating the logic — so there
 * is one orchestrator, not two.
 *
 * RACE-SAFE: uses an ATOMIC email claim. The email is only sent by the caller
 * that wins a conditional UPDATE (email_sent_at IS NULL -> now()). If the
 * browser and the webhook finish at the same instant, exactly ONE wins the
 * claim and sends; the other sees 0 claimed rows and skips. This replaces the
 * previous read-then-write `!email_sent_at` guard, which had a TOCTOU race that
 * could send two emails / two owner notifications.
 *
 * Master tier is intentionally NOT delivered here — its final email is sent by
 * the deep-dive endpoint once all sections are merged.
 *
 * @param {SupabaseClient} supabase - service-role client
 * @param {Object} report  - the report row (must include report_id, email, name, chart/birth fields, plan_*)
 * @param {Object} generated - { summary, sections }
 * @returns {Promise<{emailed:boolean, claimed:boolean}>}
 */
export async function deliverReport(supabase, report, generated) {
  const tier = report.plan_tier || "premium";
  if (tier === "master") return { emailed: false, claimed: false }; // deep-dive owns Master email
  if (!report.email || !report.email.trim()) return { emailed: false, claimed: false };

  // Atomic claim: only the caller that flips email_sent_at from NULL wins.
  const claimStamp = new Date().toISOString();
  const { data: claimedRows, error: claimErr } = await supabase
    .from("reports")
    .update({ email_sent_at: claimStamp })
    .eq("report_id", report.report_id)
    .is("email_sent_at", null)
    .select("report_id");

  const claimed = !claimErr && Array.isArray(claimedRows) && claimedRows.length > 0;
  if (!claimed) return { emailed: false, claimed: false }; // someone else already delivered

  const guidanceOn = (report.guidance_months || 0) > 0 || report.has_12_month_guidance === true;
  const emailed = await sendReportEmail({ report, generated, guidanceOn });

  // If the email actually failed, release the claim so a later run can retry.
  if (!emailed) {
    await supabase.from("reports").update({ email_sent_at: null }).eq("report_id", report.report_id);
  }

  // Owner notification (best-effort; not part of the atomic claim).
  await notifyOwner(
    report,
    report.payment_id,
    { price: report.plan_price, tier, guidanceMonths: report.guidance_months || (guidanceOn ? 12 : 0) },
    true
  );

  return { emailed, claimed: true };
}
