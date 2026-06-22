import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Fix #2: Save payment status to database on successful verification
export async function POST(request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reportId, birthDetails, chartData, previewSections, summary } =
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

      // Upsert report with paid status
      await supabase.from("reports").upsert(
        {
          report_id: reportId,
          user_id: user?.id || null,
          name: birthDetails?.name || "",
          email: birthDetails?.email || user?.email || null,
          date_of_birth: birthDetails?.dateOfBirth || "",
          time_of_birth: birthDetails?.timeOfBirth || "",
          place_of_birth: birthDetails?.placeOfBirth || "",
          gender: birthDetails?.gender || "",
          summary: summary || "",
          sections: previewSections || [],
          payment_id: razorpay_payment_id,
          payment_status: "paid",
        },
        { onConflict: "report_id" }
      );
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
