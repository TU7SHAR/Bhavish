import crypto from "crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { fulfillPayment } from "../../../lib/fulfill-payment.js";
import { safeCompare } from "../../../lib/auth.js";

// Razorpay Webhook — the server-to-server safety net.
//
// WHY THIS EXISTS:
// The browser-side Razorpay `handler` callback (which marks paid, generates the
// report, and emails it) does NOT fire reliably for UPI payments — the user pays
// inside their UPI app (GPay/PhonePe/Paytm) and often never returns to the tab,
// so nothing runs and the customer shows as "unpaid" despite paying. This webhook
// is called directly by Razorpay's servers when a payment is captured, completely
// independent of the user's browser, so payments are NEVER silently lost.
//
// SETUP (Razorpay Dashboard → Settings → Webhooks):
//   URL:    https://www.bhavishai.in/api/razorpay-webhook
//   Secret: set the same value as RAZORPAY_WEBHOOK_SECRET env var
//   Events: order.paid, payment.captured
//
// maxDuration high enough to mark paid + generate the report inline.
export const maxDuration = 60;

export async function POST(request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook] RAZORPAY_WEBHOOK_SECRET not configured");
      // 200 so Razorpay doesn't hammer retries while the env is being set up.
      return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 200 });
    }

    // Signature verification requires the RAW body (not parsed JSON).
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!safeCompare(signature, expected)) {
      console.error("[webhook] invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const type = event?.event;

    // We only care about successful-payment events.
    if (type !== "order.paid" && type !== "payment.captured") {
      return NextResponse.json({ ok: true, ignored: type }, { status: 200 });
    }

    // Resolve reportId + includeBump + paymentId from the payload.
    const details = await resolveOrderDetails(event, type);
    if (!details?.reportId) {
      console.error("[webhook] could not resolve reportId for event", type);
      // 200 — nothing actionable, don't trigger endless retries.
      return NextResponse.json({ ok: false, reason: "no_report_id" }, { status: 200 });
    }

    const result = await fulfillPayment({
      reportId: details.reportId,
      paymentId: details.paymentId,
      planId: details.planId,
      includeGuidance: details.includeGuidance,
      includeBump: details.includeBump,
      source: "webhook",
    });

    console.log(`[webhook] ${type} -> ${details.reportId}:`, result.status, result.delivered ? "(delivered)" : "");
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("[webhook] error:", error.message);
    // Return 200 to avoid infinite Razorpay retries on our internal errors —
    // the reconciliation endpoint is the backstop for anything missed.
    return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
  }
}

/**
 * Extracts { reportId, paymentId, includeBump } from a webhook payload.
 * - order.paid       → order notes/receipt + payment entity are both present.
 * - payment.captured → payment entity has order_id; fetch the order for notes.
 */
async function resolveOrderDetails(event, type) {
  const payload = event?.payload || {};

  // Extract plan info from Razorpay order/payment notes.
  const fromNotes = (notes = {}) => ({
    planId: notes.planId || null,
    includeGuidance:
      notes.guidanceMonths ? parseInt(notes.guidanceMonths, 10) > 0 : notes.has_12_month_guidance === "true",
    includeBump: notes.has_12_month_guidance === "true",
  });

  if (type === "order.paid") {
    const order = payload.order?.entity || {};
    const payment = payload.payment?.entity || {};
    const notes = order.notes || {};
    return {
      reportId: notes.reportId || order.receipt || null,
      paymentId: payment.id || null,
      ...fromNotes(notes),
    };
  }

  // payment.captured
  const payment = payload.payment?.entity || {};

  // Payment notes may carry reportId directly in some setups.
  if (payment.notes?.reportId) {
    return {
      reportId: payment.notes.reportId,
      paymentId: payment.id || null,
      ...fromNotes(payment.notes),
    };
  }

  // Otherwise fetch the parent order to read the receipt/notes.
  if (payment.order_id) {
    try {
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      const order = await razorpay.orders.fetch(payment.order_id);
      const notes = order?.notes || {};
      return {
        reportId: notes.reportId || order?.receipt || null,
        paymentId: payment.id || null,
        ...fromNotes(notes),
      };
    } catch (e) {
      console.error("[webhook] failed to fetch order", payment.order_id, e.message);
    }
  }

  return { reportId: null, paymentId: payment.id || null, planId: null, includeGuidance: false, includeBump: false };
}
