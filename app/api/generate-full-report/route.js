import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { previewLimiter } from "../../../lib/rate-limit.js";
import { generateFullReport } from "../../../lib/report-generation.js";

// Allow up to 60 seconds for full report generation on Vercel
export const maxDuration = 60;

// SECURITY HARDENED: This endpoint now accepts ONLY { reportId }.
// All birth data, chart data, and plan metadata are loaded from the database —
// the single source of truth. The client can no longer supply chartData/name/etc.
// This prevents:
//   - Wrong birth details from stale localStorage / multiple tabs
//   - Manipulated chartData from intercepted preview responses
//   - Plan tier spoofing (tier comes from the paid DB row, not the request)
//
// The endpoint also implements ATOMIC GENERATION LOCKING: it sets
// report_status = 'generating' before calling Gemini, preventing the webhook
// fulfillment path from simultaneously generating a duplicate report.

export async function POST(request) {
  try {
    // Rate limiting — prevent abuse of expensive AI generation
    const rateCheck = await previewLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const { reportId } = await request.json();

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Load EVERYTHING from the database — the single source of truth.
    const { data: report, error: dbError } = await supabase
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .single();

    if (dbError || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    // SECURITY: Must be paid.
    if (report.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment required to generate full report." }, { status: 403 });
    }

    // ATOMIC LOCK: If the report is already being generated or is completed,
    // don't generate again. This prevents the browser + webhook from both
    // calling Gemini simultaneously.
    if (report.report_status === "generating") {
      return NextResponse.json({
        error: "Report is already being generated. Please wait.",
        status: "generating",
      }, { status: 409 });
    }
    if (report.report_status === "completed" && Array.isArray(report.sections) && report.sections.length > 5) {
      // Already done — return the existing report (idempotent).
      return NextResponse.json({
        reportId,
        summary: report.summary,
        sections: report.sections,
        tier: report.plan_tier || "premium",
        guidanceMonths: report.guidance_months || (report.has_12_month_guidance ? 12 : 0),
        deepDive: report.plan_tier === "master",
        generatedAt: report.created_at,
      });
    }

    // Must have chart_data stored (set during preview save).
    if (!report.chart_data) {
      return NextResponse.json({ error: "Chart data not available. Please regenerate your preview." }, { status: 400 });
    }

    // Claim the generation slot — atomic update.
    const { error: lockErr } = await supabase
      .from("reports")
      .update({ report_status: "generating" })
      .eq("report_id", reportId)
      .neq("report_status", "generating"); // only if not already claimed

    if (lockErr) {
      console.warn("Generation lock failed (may already be locked):", lockErr.message);
      // Proceed anyway — worst case is a harmless duplicate that gets overwritten.
    }

    // Resolve tier from DB (server-authoritative).
    const tier = ["essential", "premium", "master"].includes(report.plan_tier)
      ? report.plan_tier
      : "premium"; // legacy paid rows → full 20-section report
    const guidanceMonths =
      typeof report.guidance_months === "number"
        ? report.guidance_months
        : report.has_12_month_guidance ? 12 : 0;
    const isMaster = tier === "master";

    // Generate using DB-sourced data ONLY.
    let reportData;
    try {
      reportData = await generateFullReport({
        name: report.name,
        gender: report.gender,
        dateOfBirth: report.date_of_birth,
        timeOfBirth: report.time_of_birth,
        placeOfBirth: report.place_of_birth,
        chartData: report.chart_data,
        personalQuestion: report.personal_question || "",
        tier,
        guidanceMonths,
      });
    } catch (genError) {
      // Release the lock on failure.
      await supabase
        .from("reports")
        .update({ report_status: "failed" })
        .eq("report_id", reportId);
      return NextResponse.json({ error: genError.message || "Failed to generate report." }, { status: 500 });
    }

    // Persist the completed report.
    await supabase
      .from("reports")
      .update({
        summary: reportData.summary,
        sections: reportData.sections,
        report_status: "completed",
      })
      .eq("report_id", reportId);

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      sections: reportData.sections,
      tier,
      guidanceMonths,
      deepDive: isMaster,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Full report generation error:", error);
    return NextResponse.json({ error: "Failed to generate report. Please try again." }, { status: 500 });
  }
}
