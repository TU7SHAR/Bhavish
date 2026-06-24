import crypto from "crypto";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Verifies the ₹999 founder upgrade payment and marks user as founder member
export async function POST(request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, reportId } =
      await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment verification details" },
        { status: 400 }
      );
    }

    // Verify signature
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

    // Mark as founder member in DB
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

      await supabase
        .from("reports")
        .update({
          is_founder_member: true,
          founder_upgrade_payment_id: razorpay_payment_id,
        })
        .eq("report_id", reportId);
    } catch (dbError) {
      console.error("DB update error (non-critical):", dbError.message);
    }

    return NextResponse.json({
      success: true,
      paymentId: razorpay_payment_id,
    });
  } catch (error) {
    console.error("Upgrade verification error:", error);
    return NextResponse.json(
      { error: "Verification failed. Please contact support." },
      { status: 500 }
    );
  }
}
