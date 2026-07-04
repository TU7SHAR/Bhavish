import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// POST /api/track/visit
// Lightweight endpoint — fire-and-forget from the client.
// Stores a page view event in the visitor_sessions table.
export async function POST(request) {
  try {
    const body = await request.json();
    const { visitor_id, session_id, page, device_type, utm_source, utm_medium, utm_campaign, referrer } = body;

    // Minimum required fields
    if (!visitor_id || !session_id || !page) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await supabase.from("visitor_sessions").insert({
      visitor_id,
      session_id,
      page,
      device_type: device_type || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      referrer: referrer || null,
    });

    // Always return 200 — tracking errors should never propagate to the user
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
