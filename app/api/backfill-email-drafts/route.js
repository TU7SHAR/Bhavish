import { generateEmailDrafts } from "../../../lib/email-sequence.js";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// One-time / occasional helper: generate email drafts for EXISTING unpaid
// leads that predate Option B (email_drafts IS NULL). Processes a SMALL batch
// per call so it stays under the function timeout and the Gemini rate limit
// (gemini-3.1-flash-lite = 15 RPM). Re-trigger until "remaining" hits 0.
//
//   GET /api/backfill-email-drafts            -> default batch of 3
//   GET /api/backfill-email-drafts?batch=5    -> custom batch size
//
// Protect with CRON_SECRET if set: send header  Authorization: Bearer <secret>
export const maxDuration = 60;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const batchSize = Math.min(Math.max(parseInt(searchParams.get("batch") || "3", 10) || 3, 1), 8);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Leads needing drafts: unpaid, have an email, no drafts yet.
    const { data: leads, error: fetchError } = await supabase
      .from("reports")
      .select("report_id, name, summary, sections, date_of_birth, place_of_birth")
      .eq("payment_status", "unpaid")
      .not("email", "is", null)
      .neq("email", "")
      .is("email_drafts", null)
      .order("created_at", { ascending: false })
      .limit(batchSize);

    if (fetchError) {
      console.error("Backfill fetch failed:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: "Nothing to backfill", processed: 0, remaining: 0 });
    }

    let processed = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const emails = await generateEmailDrafts({
          name: lead.name,
          summary: lead.summary,
          sections: lead.sections,
          dateOfBirth: lead.date_of_birth,
          placeOfBirth: lead.place_of_birth,
          personalQuestion: "",
        });

        const { error: updateError } = await supabase
          .from("reports")
          .update({ email_drafts: emails, email_sequence_status: "active" })
          .eq("report_id", lead.report_id);

        if (updateError) {
          errors.push({ report_id: lead.report_id, error: updateError.message });
          continue;
        }
        processed++;
      } catch (e) {
        errors.push({ report_id: lead.report_id, error: e.message });
      }
    }

    // How many still need drafts after this batch?
    const { count: remaining } = await supabase
      .from("reports")
      .select("report_id", { count: "exact", head: true })
      .eq("payment_status", "unpaid")
      .not("email", "is", null)
      .neq("email", "")
      .is("email_drafts", null);

    return NextResponse.json({
      success: true,
      processed,
      remaining: remaining ?? "unknown",
      errors,
      note: remaining > 0 ? "Re-run this endpoint until remaining = 0" : "All caught up",
    });
  } catch (error) {
    console.error("Backfill error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
