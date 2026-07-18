import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServiceClient } from "../../../lib/supabase-service.js";
import { resolvePlan, resolveLegacyBump } from "../../../lib/plans.js";
import { classifyFocus } from "../../../lib/deep-dive.js";

export async function POST(request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reportId, birthDetails, chartData, previewSections, summary, planId, includeGuidance, includeBump } =
      await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification details" },
        { status: 400 }
      );
    }

    // Verify the payment signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      return NextResponse.json(
        { error: "Payment verification failed. Please contact support." },
        { status: 400 }
      );
    }

    // Resolve the purchased plan (server-authoritative). New clients send
    // planId (+ includeGuidance for Essential); legacy clients send includeBump.
    const resolvedPlan = planId
      ? resolvePlan(planId, { includeGuidance: !!includeGuidance })
      : resolveLegacyBump(includeBump);

    // Save payment status to database
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

      // Service-role client for the write (bypasses RLS).
      const supabase = createServiceClient();

      const { data: { user } } = await authClient.auth.getUser();

      const plan = resolvedPlan;
      const guidanceOn = (plan?.guidanceMonths || 0) > 0;

      const now = new Date();
      const guidanceEnd = new Date(now);
      guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

      // CRITICAL: Use .update() NOT .upsert() — only change payment fields.
      // .upsert() rewrites the entire row and wipes attribution, city,
      // device_type, personal_question, email_drafts, etc.
      const updateData = {
        payment_id: razorpay_payment_id,
        payment_status: "paid",
        // Legacy flags kept in sync for backward compatibility.
        has_12_month_guidance: guidanceOn,
        guidance_start_date: guidanceOn ? now.toISOString() : null,
        guidance_end_date: guidanceOn ? guidanceEnd.toISOString() : null,
      };

      // New plan metadata.
      if (plan) {
        updateData.plan_tier = plan.tier;
        updateData.plan_price = plan.price;
        updateData.guidance_months = plan.guidanceMonths;
        if (plan.deepDive) {
          updateData.deep_dive_status = "pending";
          updateData.deep_dive_focus = classifyFocus(birthDetails?.personalQuestion);
        } else {
          updateData.deep_dive_status = "none";
        }
      }

      // Only set user_id if user is logged in (don't wipe existing with null)
      if (user?.id) updateData.user_id = user.id;

      // Try with the full column set (new columns + paid_at); progressively
      // fall back if some columns don't exist yet (migrations not run).
      let { error: updateErr } = await supabase
        .from("reports")
        .update({ ...updateData, paid_at: now.toISOString() })
        .eq("report_id", reportId);

      if (updateErr) {
        // Retry without the new plan columns (keep legacy fields + paid_at).
        const { plan_tier, plan_price, guidance_months, deep_dive_status, deep_dive_focus, ...legacyOnly } = updateData;
        let retry = await supabase
          .from("reports")
          .update({ ...legacyOnly, paid_at: now.toISOString() })
          .eq("report_id", reportId);
        if (retry.error) {
          // Final fallback: legacy fields, no paid_at.
          await supabase.from("reports").update(legacyOnly).eq("report_id", reportId);
        }
      }
    } catch (dbError) {
      // Don't fail payment verification if DB save fails
      console.error("DB save error (non-critical):", dbError.message);
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
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
