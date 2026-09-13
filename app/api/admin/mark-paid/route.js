import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { fulfillPayment } from "../../../../lib/fulfill-payment.js";
import { logEvent, logError } from "../../../../lib/ops-log.js";

// SUPER-ADMIN: manually mark a report PAID and fully fulfil it.
//
// WHY THIS EXISTS:
// Today two failure modes appeared:
//   1. Payment captured by Razorpay, user marked paid, but NO delivery/sale
//      notification fired.
//   2. Razorpay payment captured, but the user was never even marked paid.
// The reconcile cron + /api/admin/reconcile-payments already recover most of
// these automatically, but when they don't, support needs a one-click manual
// override. This is that override.
//
// It delegates to the SAME idempotent fulfillPayment() orchestrator every other
// path uses, so it:
//   - marks the row paid (if not already),
//   - resolves the plan (explicit planId here wins, else the row's tier),
//   - generates the report if missing (never re-generates one that exists),
//   - delivers the email + owner "New Sale" notification,
//   - fires the Meta CAPI Purchase (subject to the freshness guard).
//
// Safe to click repeatedly: fulfillPayment is idempotent. If the report already
// exists it is NOT regenerated (use the separate Regenerate action for that).
//
// POST /api/admin/mark-paid
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: {
//   reportId: "RPT-...",              // required
//   planId?: "essential"|"premium"|"master",  // optional; else uses row's tier
//   includeGuidance?: boolean,        // optional 12-month add-on
//   paymentId?: "pay_..."             // optional, for the money record
// }
export const maxDuration = 60;

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { reportId, planId = null, includeGuidance = false, paymentId = null } = body || {};

  if (!reportId) {
    return NextResponse.json({ error: "reportId is required" }, { status: 400 });
  }
  if (planId && !["essential", "premium", "master"].includes(planId)) {
    return NextResponse.json(
      { error: "planId must be essential, premium, or master" },
      { status: 400 }
    );
  }

  try {
    // Durable audit trail: who was manually marked paid, and with what override.
    await logEvent({
      event: "admin.mark_paid",
      level: "warn", // warn so it stands out in the log — it's a manual override
      source: "admin-mark-paid",
      reportId,
      message: `manual mark-paid${planId ? ` as ${planId}` : ""}`,
      meta: { planId, includeGuidance: !!includeGuidance, paymentId: paymentId || null },
    });

    const result = await fulfillPayment({
      reportId,
      paymentId,
      planId,
      includeGuidance: !!includeGuidance,
      includeBump: !!includeGuidance,
      source: "admin-mark-paid",
    });

    return NextResponse.json({
      ok: true,
      reportId,
      // Human-readable outcome for the admin toast.
      outcome: result.status,
      delivered: !!result.delivered,
      tier: result.tier || planId || null,
      detail: result.detail || null,
    });
  } catch (error) {
    console.error("[mark-paid] error:", error.message);
    await logError({
      event: "admin.mark_paid_failed",
      source: "admin-mark-paid",
      reportId,
      message: "manual mark-paid threw",
      error,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
