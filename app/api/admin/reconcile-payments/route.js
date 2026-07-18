import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { fulfillPayment } from "../../../../lib/fulfill-payment.js";

// Admin reconciliation — the manual backstop that cross-checks Razorpay against
// our database and fixes any payment that was captured by Razorpay but never
// marked paid here (e.g. UPI users whose browser callback never fired, before
// the webhook was live, or if a webhook delivery was missed).
//
// GET /api/admin/reconcile-payments
//   Header: Authorization: Bearer <ADMIN_SECRET or CRON_SECRET>
//
// Query params (all optional):
//   ?count=50            how many recent Razorpay payments to scan (default 30, max 100)
//   ?reportId=RPT-...    reconcile ONE specific report (must also pass paymentId or we look it up)
//   ?paymentId=pay_...   fulfil a specific payment id directly
//   ?includeBump=true    force the 12-month add-on when reconciling a specific report
//
// maxDuration high because it may generate reports for missed payments.
export const maxDuration = 60;

export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const specificReportId = searchParams.get("reportId");
  const specificPaymentId = searchParams.get("paymentId");
  const forceBump = searchParams.get("includeBump") === "true";
  const forcePlanId = searchParams.get("planId") || null; // essential | premium | master
  const count = Math.min(Math.max(parseInt(searchParams.get("count") || "30", 10) || 30, 1), 100);

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    // MODE A: reconcile a single report explicitly (fastest recovery for a known stuck customer)
    if (specificReportId) {
      const result = await fulfillPayment({
        reportId: specificReportId,
        paymentId: specificPaymentId || null,
        planId: forcePlanId,
        includeGuidance: forceBump,
        includeBump: forceBump,
        source: "reconcile-one",
      });
      return NextResponse.json({ mode: "single", ...result });
    }

    // MODE B: reconcile a specific payment id — look up its order to find the reportId
    if (specificPaymentId) {
      const payment = await razorpay.payments.fetch(specificPaymentId);
      const details = await orderDetailsFromPayment(razorpay, payment);
      if (!details.reportId) {
        return NextResponse.json({ mode: "payment", error: "Could not resolve reportId from payment" }, { status: 400 });
      }
      const result = await fulfillPayment({
        reportId: details.reportId,
        paymentId: payment.id,
        planId: forcePlanId || details.planId,
        includeGuidance: details.includeGuidance || forceBump,
        includeBump: details.includeBump || forceBump,
        source: "reconcile-payment",
      });
      return NextResponse.json({ mode: "payment", ...result });
    }

    // MODE C: scan recent captured payments and fulfil any that are missed
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
        source: "reconcile-scan",
      });
      results.push({ paymentId: payment.id, ...result });
    }

    const summary = {
      scanned: items.length,
      captured: captured.length,
      fulfilled: results.filter((r) => r.status === "fulfilled").length,
      alreadyDone: results.filter((r) => r.status === "already_done").length,
      notFound: results.filter((r) => r.status === "not_found").length,
      failed: results.filter((r) => ["mark_paid_failed", "paid_no_chartdata", "no_report_id", "error"].includes(r.status)).length,
    };

    return NextResponse.json({ mode: "scan", summary, results });
  } catch (error) {
    console.error("[reconcile] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Resolve { reportId, planId, includeGuidance, includeBump } for a payment by
// reading its parent order notes.
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
      console.error("[reconcile] order fetch failed", payment.order_id, e.message);
    }
  }
  return { reportId: null, planId: null, includeGuidance: false, includeBump: false };
}
