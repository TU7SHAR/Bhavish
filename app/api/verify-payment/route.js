import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Fix #2: Save payment status to database on successful verification
export async function POST(request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reportId, birthDetails, chartData, previewSections, summary, includeBump } =
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

    // Fix #2: Save to Supabase with payment confirmed
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
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

      const { data: { user } } = await supabase.auth.getUser();

      // Update ONLY payment-related fields on the existing row.
      // Using .update() instead of .upsert() so we don't overwrite
      // attribution, personal_question, city, device_type, etc.
      const now = new Date();
      const guidanceEnd = new Date(now);
      guidanceEnd.setMonth(guidanceEnd.getMonth() + 12);

      const updateData = {
        payment_id: razorpay_payment_id,
        payment_status: "paid",
        paid_at: now.toISOString(),
        has_12_month_guidance: !!includeBump,
        guidance_start_date: includeBump ? now.toISOString() : null,
        guidance_end_date: includeBump ? guidanceEnd.toISOString() : null,
      };

      // Only set user_id if user is actually logged in (don't wipe existing)
      if (user?.id) updateData.user_id = user.id;

      let { error: updateErr } = await supabase
        .from("reports")
        .update(updateData)
        .eq("report_id", reportId);

      // Fallback: if paid_at column doesn't exist yet, retry without it
      if (updateErr) {
        const { paid_at, ...coreUpdate } = updateData;
        await supabase
          .from("reports")
          .update(coreUpdate)
          .eq("report_id", reportId);
      }
    } catch (dbError) {
      // Don't fail the payment verification if DB save fails
      console.error("DB save error (non-critical):", dbError.message);
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
      message: "Payment verified successfully",
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    return NextResponse.json(
      { error: "Payment verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
