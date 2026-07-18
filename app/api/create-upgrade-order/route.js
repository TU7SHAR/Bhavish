import { NextResponse } from "next/server";

// Founder Access is retired for new purchases (replaced by the three-tier
// Essential / Premium / Master model). Existing Founder members are
// grandfathered and keep their access via /founder/new.
//
// This endpoint previously created a ₹999 Razorpay order for the Founder
// upgrade. It now returns 410 Gone to prevent any new Founder purchases.
export async function POST() {
  return NextResponse.json(
    { error: "Founder Access is no longer available for purchase. Choose Essential, Premium or Master at checkout." },
    { status: 410 }
  );
}
