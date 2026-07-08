import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { paymentLimiter } from "../../../lib/rate-limit.js";

// Server-side prices — NEVER trust frontend amount
const PRICE_BASE = parseInt(process.env.NEXT_PUBLIC_PRICE_BASE || "299");
const PRICE_BUMP = parseInt(process.env.NEXT_PUBLIC_PRICE_BUMP || "149");

export async function POST(request) {
  try {
    // Rate limiting — prevent order creation spam
    const rateCheck = paymentLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const { reportId, email, name, includeBump } = await request.json();

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

    // SERVER decides the price — frontend cannot manipulate this
    const totalPrice = includeBump ? PRICE_BASE + PRICE_BUMP : PRICE_BASE;
    const amount = totalPrice * 100; // paise

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: reportId,
      notes: {
        reportId,
        customerEmail: email || "",
        customerName: name || "",
        has_12_month_guidance: includeBump ? "true" : "false",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      includeBump: !!includeBump,
      totalPrice,
    });
  } catch (error) {
    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Failed to create payment order. Please try again." },
      { status: 500 }
    );
  }
}
