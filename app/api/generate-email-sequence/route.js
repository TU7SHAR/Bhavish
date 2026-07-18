import { generateEmailDrafts } from "../../../lib/email-sequence.js";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyInternal } from "../../../lib/auth.js";
import { emailGenLimiter } from "../../../lib/rate-limit.js";

// Runs in the background after a preview is generated. Makes ONE Gemini call
// to draft all 10 nurture emails, then stores them as JSONB in
// reports.email_drafts. The cron later just READS + SENDS them (no AI call at
// send time), so it fits inside Vercel's function timeout.
export const maxDuration = 30;

export async function POST(request) {
  try {
    // SECURITY FIX: Require internal authentication.
    // This endpoint triggers expensive Gemini AI calls — must not be publicly accessible.
    const auth = verifyInternal(request);
    if (!auth.authorized) return auth.error;

    // Additional rate limiting as defense-in-depth
    const rateCheck = await emailGenLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const { reportId, name, summary, sections, dateOfBirth, placeOfBirth, personalQuestion } =
      await request.json();

    if (!reportId || !name) {
      return NextResponse.json({ error: "Missing reportId or name" }, { status: 400 });
    }

    const emails = await generateEmailDrafts({
      name,
      summary,
      sections,
      dateOfBirth,
      placeOfBirth,
      personalQuestion,
    });

    // Persist drafts. Service role preferred (bypasses RLS for the background
    // write); falls back to anon key if not configured.
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error: updateError } = await supabase
      .from("reports")
      .update({ email_drafts: emails, email_sequence_status: "active" })
      .eq("report_id", reportId);

    if (updateError) {
      console.error("Failed to store email drafts:", updateError);
      return NextResponse.json({ error: "Failed to store drafts" }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: emails.length });
  } catch (error) {
    console.error("generate-email-sequence error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
