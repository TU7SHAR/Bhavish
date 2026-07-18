import { NextResponse } from "next/server";

// Founder upgrade verification is retired. The ₹999 Founder purchase flow
// no longer exists for new users. Existing Founder members keep their access.
//
// Returns 410 Gone so any lingering client code gets a clear signal.
export async function POST() {
  return NextResponse.json(
    { error: "Founder Access is no longer available for purchase." },
    { status: 410 }
  );
}
