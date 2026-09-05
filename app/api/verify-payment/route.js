import crypto from "crypto";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "../../../lib/supabase-service.js";
import { resolvePlan, resolveLegacyBump } from "../../../lib/plans.js";
import { classifyFocus } from "../../../lib/deep-dive.js";
import { ensureAccessToken } from "../../../lib/report-access.js";

// Verifies the Razorpay payment signature, then derives ALL plan metadata from
// the Razorpay ORDER (server-to-server fetch), NOT from client-supplied values.
//
// Why: the client sends razorpay_order_id + payment_id + signature. The HMAC
// proves the payment is genuine, but does NOT prove the client's self-reported
// planId, reportId, or amount. To prevent a ₹299 payment being claimed as a
// ₹999 Master purchase, we fetch the order from Razorpay and read its notes +
// amount — which were set server-side by /api/create-order.

export async function POST(request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification details" },
        { status: 400 }
      );
    }

    // 1. Verify the HMAC signature (proves the payment callback is genuine).
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json(
        { error: "Payment verification failed. Please contact support." },
        { status: 400 }
      );
    }

    // 2. Fetch the order from Razorpay to get the SERVER-SET notes.
    //    These notes were written by /api/create-order and cannot be tampered
    //    with by the client. This is our single source of truth for:
    //      - reportId
    //      - planId / planTier
    //      - guidanceMonths
    //      - amount paid
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    let order;
    try {
      order = await razorpay.orders.fetch(razorpay_order_id);
    } catch (fetchErr) {
      console.error("Failed to fetch Razorpay order:", fetchErr.message);
      // Signature IS valid so payment happened. But we cannot determine which
      // report to mark paid or what tier they bought. Return a distinct status
      // so the client shows "payment confirmed, report being prepared" instead
      // of "success!" — the webhook/reconciliation will complete fulfillment.
      return NextResponse.json({
        paymentConfirmed: true,
        fulfillmentPending: true,
        paymentId: razorpay_payment_id,
        message: "Payment confirmed. Your report is being prepared and will be emailed to you shortly.",
      });
    }

    const notes = order.notes || {};
    const reportId = notes.reportId || order.receipt;
    let accessToken = null; // minted below; returned so the browser can prove ownership
    const orderPlanId = notes.planId || null;
    const orderGuidanceMonths = notes.guidanceMonths ? parseInt(notes.guidanceMonths, 10) : 0;
    const orderIncludeGuidance = orderGuidanceMonths > 0 || notes.has_12_month_guidance === "true";

    if (!reportId) {
      // Payment valid but can't identify report. Webhook/reconcile will fix.
      return NextResponse.json({
        paymentConfirmed: true,
        fulfillmentPending: true,
        paymentId: razorpay_payment_id,
        message: "Payment confirmed. Your report is being prepared.",
      });
    }

    // 3. Resolve plan from ORDER notes (not client). Falls back to legacy logic.
    const resolvedPlan = orderPlanId
      ? resolvePlan(orderPlanId, { includeGuidance: orderIncludeGuidance })
      : resolveLegacyBump(orderIncludeGuidance);

    // 4. Save payment status to database.
    try {
      const cookieStore = await cookies();
      const authClient = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
            },
          },
        }
      );

      const supabase = createServiceClient();
      const { data: { user } } = await authClient.auth.getUser();

      const plan = resolvedPlan;
      const guidanceOn = (plan?.guidanceMonths || 0) > 0;
      const now = new Date();
      const guidanceEnd = new Date(now);
      guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

      // Read the report row to get the personal_question for deep-dive focus.
      let personalQuestion = "";
      try {
        const { data: existingReport } = await supabase
          .from("reports")
          .select("personal_question")
          .eq("report_id", reportId)
          .single();
        personalQuestion = existingReport?.personal_question || "";
      } catch {}

      const updateData = {
        payment_id: razorpay_payment_id,
        payment_status: "paid",
        has_12_month_guidance: guidanceOn,
        guidance_start_date: guidanceOn ? now.toISOString() : null,
        guidance_end_date: guidanceOn ? guidanceEnd.toISOString() : null,
      };

      if (plan) {
        updateData.plan_tier = plan.tier;
        updateData.plan_price = plan.price;
        updateData.guidance_months = plan.guidanceMonths;
        if (plan.deepDive) {
          updateData.deep_dive_status = "pending";
          updateData.deep_dive_focus = classifyFocus(personalQuestion);
        } else {
          updateData.deep_dive_status = "none";
        }
      }

      if (user?.id) updateData.user_id = user.id;

      // Progressive fallback if newer columns don't exist.
      let { error: updateErr } = await supabase
        .from("reports")
        .update({ ...updateData, paid_at: now.toISOString() })
        .eq("report_id", reportId);

      if (updateErr) {
        const { plan_tier, plan_price, guidance_months, deep_dive_status, deep_dive_focus, ...legacyOnly } = updateData;
        let retry = await supabase
          .from("reports")
          .update({ ...legacyOnly, paid_at: now.toISOString() })
          .eq("report_id", reportId);
        if (retry.error) {
          await supabase.from("reports").update(legacyOnly).eq("report_id", reportId);
        }
      }

      // Mint the report access token (192-bit, unguessable). Returned to the
      // buyer's browser so it can prove ownership when calling
      // /api/generate-full-report — closing the "guess a paid reportId to read
      // someone's report" hole without requiring login.
      try {
        accessToken = await ensureAccessToken(supabase, reportId);
      } catch (tokErr) {
        console.error("access token mint failed (non-critical):", tokErr.message);
      }
    } catch (dbError) {
      console.error("DB save error (non-critical):", dbError.message);
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      reportId,
      accessToken,
      message: "Payment verified successfully",
      tier: resolvedPlan?.tier || "premium",
      guidanceMonths: resolvedPlan?.guidanceMonths || 0,
      deepDive: !!resolvedPlan?.deepDive,
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
