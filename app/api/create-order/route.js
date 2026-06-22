import Razorpay from "razorpay";
import { NextResponse } from "next/server";

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

    const amount = parseInt(process.env.NEXT_PUBLIC_REPORT_PRICE || "199") * 100; // Amount in paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: reportId,
      notes: {
        reportId,
        customerEmail: email || "",
        customerName: name || "",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
