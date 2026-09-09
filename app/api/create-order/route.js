import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { paymentLimiter } from "../../../lib/rate-limit.js";
import { resolvePlan, resolveLegacyBump } from "../../../lib/plans.js";
import { logEvent, logWarn, logError } from "../../../lib/ops-log.js";

export async function POST(request) {
  try {
    // Rate limiting — prevent order creation spam
    const rateCheck = await paymentLimiter(request);
    if (!rateCheck.allowed) {
      await logWarn({
        event: "funnel.order_rate_limited",
        source: "create-order",
        message: "IP hit the 5/min order limit",
      });
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const { reportId, email, name, planId, includeGuidance, includeBump } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    // SERVER decides the plan + price. The client only sends a planId (and, for
    // Essential, whether the ₹149 guidance add-on was ticked). Never trust a
    // price coming from the client.
    //   New clients:  { planId: "essential"|"premium"|"master", includeGuidance }
    //   Legacy clients (pre-tiers): { includeBump } → mapped onto Essential.
    const plan = planId
      ? resolvePlan(planId, { includeGuidance: !!includeGuidance })
      : resolveLegacyBump(includeBump);

    if (!plan) {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amount = plan.price * 100; // paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: reportId,
      notes: {
        reportId,
        customerEmail: email || "",
        customerName: name || "",
        // New plan metadata (source of truth for fulfillment).
        planId: plan.planId,
        planTier: plan.tier,
        guidanceMonths: String(plan.guidanceMonths),
        deepDive: plan.deepDive ? "true" : "false",
        // Legacy note kept so the webhook/reconciliation amount-based fallback
        // and older code paths still understand guidance.
        has_12_month_guidance: plan.guidanceMonths > 0 ? "true" : "false",
      },
    });

    // FUNNEL STEP 2: the user clicked Pay and a Razorpay order exists. The gap
    // between funnel.preview_generated and this event IS the paywall drop-off —
    // the single most important number for diagnosing "why is nobody paying".
    await logEvent({
      event: "funnel.order_created",
      source: "create-order",
      reportId,
      message: `clicked Pay — ${plan.tier} ₹${plan.price}`,
      meta: {
        orderId: order.id,
        tier: plan.tier,
        planId: plan.planId,
        price: plan.price,
        guidanceMonths: plan.guidanceMonths,
        deepDive: !!plan.deepDive,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planId: plan.planId,
      tier: plan.tier,
      guidanceMonths: plan.guidanceMonths,
      deepDive: plan.deepDive,
      totalPrice: plan.price,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    // The user WANTED to pay and we failed them. Highest-severity funnel event.
    await logError({
      event: "funnel.order_failed",
      source: "create-order",
      message: "Razorpay order creation failed — user could not pay",
      error,
    });
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
