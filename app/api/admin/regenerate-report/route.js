import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../../lib/geocode.js";
import { verifyAdmin } from "../../../../lib/auth.js";
import { generateFullReport } from "../../../../lib/report-generation.js";
import { resolvePlan } from "../../../../lib/plans.js";

// Admin endpoint: regenerate a customer's report from scratch, TIER-AWARE.
// Recalculates the chart from birth details, then generates exactly what the
// chosen tier includes (reusing the same shared generators as the live flow):
//   - essential → 10 core sections + personal answer (+ 12-month guidance if requested)
//   - premium   → 20 core sections + personal answer + 12-month guidance
//   - master    → premium main report + a 7-section concern deep-dive + 24-month roadmap
//
// POST /api/admin/regenerate-report
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId, tier?: "essential"|"premium"|"master", includeGuidance?: boolean }
// Defaults to "premium" when no tier is passed (preserves the old 20-section behavior).
export const maxDuration = 60;

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId, tier: rawTier, includeGuidance } = await request.json();
    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    const tierId = ["essential", "premium", "master"].includes(rawTier) ? rawTier : "premium";
    const plan = resolvePlan(tierId, { includeGuidance: !!includeGuidance });
    if (!plan) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, gender, date_of_birth, time_of_birth, place_of_birth, personal_question")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (!report.date_of_birth || !report.time_of_birth || !report.place_of_birth) {
      return NextResponse.json({ error: "Report is missing birth details — cannot recalculate chart" }, { status: 400 });
    }

    // Recalculate the birth chart from stored birth details.
    const location = await geocodePlace(report.place_of_birth);
    const chartData = calculateBirthChart({
      dateOfBirth: report.date_of_birth,
      timeOfBirth: report.time_of_birth,
      latitude: location.latitude,
      longitude: location.longitude,
      timezoneOffsetMinutes: location.timezoneOffsetMinutes,
    });

    // Generate the tier-appropriate main report via the shared generator.
    const { summary, sections } = await generateFullReport({
      name: report.name,
      gender: report.gender,
      dateOfBirth: report.date_of_birth,
      timeOfBirth: report.time_of_birth,
      placeOfBirth: report.place_of_birth,
      chartData,
      personalQuestion: report.personal_question,
      tier: plan.tier,
      guidanceMonths: plan.guidanceMonths,
    });

    // Persist the main report first so it's never lost if the (optional,
    // longer) Master deep-dive step times out or fails.
    const baseUpdate = {
      summary,
      sections,
      chart_data: chartData,
      plan_tier: plan.tier,
      plan_price: plan.price,
      guidance_months: plan.guidanceMonths,
    };
    if (plan.deepDive) {
      baseUpdate.deep_dive_status = "pending";
      baseUpdate.report_status = "completed";
    }

    let updateErr = (await saveReport(supabase, reportId, baseUpdate)).error;
    if (updateErr) {
      return NextResponse.json({ error: "Report generated but DB save failed: " + updateErr.message }, { status: 500 });
    }

    // Master: trigger the deep-dive as a SEPARATE async call (same pattern as
    // the live purchase flow). This avoids blowing the 60s timeout when both
    // the main report and deep-dive each need retries (~15s+ each).
    let deepDiveFocus = null;
    let deepDiveSectionCount = 0;
    if (plan.deepDive) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
        const deepDiveRes = await fetch(`${baseUrl}/api/generate-master-deep-dive`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId }),
        });
        const ddJson = await deepDiveRes.json();
        if (deepDiveRes.ok && ddJson.status === "completed") {
          deepDiveFocus = ddJson.focus;
          deepDiveSectionCount = (ddJson.deepDiveSections || []).length;
        } else if (deepDiveRes.ok && (ddJson.status === "already_done" || ddJson.status === "generating")) {
          // Deep-dive was already completed or is in progress
          deepDiveFocus = ddJson.focus || "in_progress";
        } else {
          // Deep-dive call failed but main report is saved — return partial success
          return NextResponse.json({
            success: true,
            partial: true,
            reportId,
            tier: plan.tier,
            price: plan.price,
            sectionCount: sections.length,
            note: "Main report regenerated successfully. Deep-dive generation started but may still be processing. Check back in ~30s or click Regen Master again.",
            deepDiveError: ddJson.error || ddJson.message,
          });
        }
      } catch (ddError) {
        // Main report is already saved; report partial success
        return NextResponse.json({
          success: true,
          partial: true,
          reportId,
          tier: plan.tier,
          price: plan.price,
          sectionCount: sections.length,
          note: "Main report regenerated. Deep-dive call failed: " + ddError.message + ". Click Regen Master again to retry deep-dive.",
        });
      }
    }

    return NextResponse.json({
      success: true,
      reportId,
      tier: plan.tier,
      price: plan.price,
      sectionCount: sections.length + deepDiveSectionCount,
      deepDiveFocus,
    });
  } catch (error) {
    console.error("regenerate-report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Update the report; if newer columns (plan_tier, chart_data, deep_dive_*)
// don't exist yet in the DB, retry with only the always-present fields so
// regeneration still succeeds on un-migrated databases.
async function saveReport(supabase, reportId, update) {
  let { error } = await supabase.from("reports").update(update).eq("report_id", reportId);
  if (error) {
    const fallback = {};
    if ("summary" in update) fallback.summary = update.summary;
    if ("sections" in update) fallback.sections = update.sections;
    if (Object.keys(fallback).length === 0) return { error: null };
    const retry = await supabase.from("reports").update(fallback).eq("report_id", reportId);
    error = retry.error;
  }
  return { error };
}
