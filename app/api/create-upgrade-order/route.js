import Razorpay from "razorpay";
import { NextResponse } from "next/server";

// Dedicated endpoint for the ₹999 lifetime founder upgrade
const PRICE_UPGRADE = parseInt(process.env.NEXT_PUBLIC_PRICE_UPGRADE || "999");

export async function POST(request) {
  try {
    const { reportId, email, name } = await request.json();

    if (!reportId) {
      return NextResponse.json(
        { error: "Report ID is required" },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const amount = PRICE_UPGRADE * 100; // paise — server-controlled

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `UPG-${reportId}`,
      notes: {
        reportId,
        customerEmail: email || "",
        customerName: name || "",
        is_founder_upgrade: "true",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Upgrade order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create upgrade order. Please try again." },
      { status: 500 }
    );
  }
}
