import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Public unsubscribe endpoint. Marketing/nurture emails link to
// /unsubscribe?email=... — this backs that page.
//
// We set email_sequence_status = "unsubscribed" on EVERY row for the given
// email (a person can have multiple lead rows). The nurture senders skip any
// row whose status is "unsubscribed", so this stops all future nurture emails.
//
// NOTE: this uses the existing email_sequence_status column, so no DB
// migration is needed. Transactional emails (report delivery, payment
// confirmations) are sent through separate flows and are not affected.
//
// POST /api/unsubscribe   Body: { email, resubscribe? }

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(request) {
  try {
    const { email, resubscribe } = await request.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    const normalized = email.trim().toLowerCase();
    const supabase = getSupabase();

    // Find all rows for this email (case-insensitive).
    const { data: rows, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, email, emails_sent_count")
      .ilike("email", normalized);

    if (fetchErr) {
      return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
    }

    if (!rows || rows.length === 0) {
      // Don't leak whether the email exists — respond as if it succeeded.
      return NextResponse.json({
        success: true,
        matched: 0,
        message: resubscribe ? "You're subscribed." : "You've been unsubscribed.",
      });
    }

    const reportIds = rows.map((r) => r.report_id);

    if (resubscribe) {
      // Re-enable the sequence. Rows that already finished their sequence stay
      // finished; anyone mid-sequence goes back to "active".
      const { error: updErr } = await supabase
        .from("reports")
        .update({ email_sequence_status: "active" })
        .in("report_id", reportIds);
      if (updErr) {
        return NextResponse.json({ error: "Could not update your preference. Please try again." }, { status: 500 });
      }
      return NextResponse.json({ success: true, matched: reportIds.length, message: "You're subscribed again." });
    }

    const { error: updErr } = await supabase
      .from("reports")
      .update({ email_sequence_status: "unsubscribed" })
      .in("report_id", reportIds);

    if (updErr) {
      return NextResponse.json({ error: "Could not unsubscribe you. Please try again." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      matched: reportIds.length,
      message: "You've been unsubscribed.",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
