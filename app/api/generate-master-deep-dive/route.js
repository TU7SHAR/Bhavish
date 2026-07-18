import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-service.js";
import { generateDeepDive, classifyFocus } from "../../../lib/deep-dive.js";
import { previewLimiter } from "../../../lib/rate-limit.js";

// Master-tier ONLY: generate the concern-specific deep-dive (7 sections) +
// 24-month roadmap. This is a SEPARATE job from /api/generate-full-report so
// that neither AI call risks the 60s serverless timeout.
//
// Flow: the main Premium-style report is generated first (full-report/fulfill),
// then the client (or fulfillment) calls this to append the deep-dive.
//
// POST /api/generate-master-deep-dive  Body: { reportId }
export const maxDuration = 60;

export async function POST(request) {
  try {
    const rateCheck = await previewLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const { reportId } = await request.json();
    if (!reportId) {
      return NextResponse.json({ error: "reportId is required" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: report, error } = await supabase
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .single();

    if (error || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    // SECURITY: must be a paid Master report.
    if (report.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment required." }, { status: 403 });
    }
    if (report.plan_tier !== "master") {
      return NextResponse.json({ error: "Deep-dive is a Master-tier feature." }, { status: 403 });
    }

    if (!report.chart_data) {
      return NextResponse.json({ error: "Chart data unavailable for this report." }, { status: 400 });
    }

    // Idempotency: if the deep-dive is already present, don't regenerate.
    const existing = Array.isArray(report.sections) ? report.sections : [];
    const alreadyHasDeepDive =
      report.deep_dive_status === "completed" ||
      existing.some((s) => /deep dive|deep-dive|roadmap/i.test(s.title || ""));
    if (alreadyHasDeepDive) {
      return NextResponse.json({ status: "already_done", reportId, sections: existing });
    }

    const focus = report.deep_dive_focus || classifyFocus(report.personal_question);

    // Mark generating (best-effort).
    await supabase
      .from("reports")
      .update({ deep_dive_status: "generating", deep_dive_focus: focus })
      .eq("report_id", reportId);

    let deepDive;
    try {
      deepDive = await generateDeepDive({
        name: report.name,
        chartData: report.chart_data,
        personalQuestion: report.personal_question || "",
        focus,
      });
    } catch (genErr) {
      await supabase
        .from("reports")
        .update({ deep_dive_status: "failed" })
        .eq("report_id", reportId);
      return NextResponse.json({ error: genErr.message || "Deep-dive generation failed." }, { status: 500 });
    }

    // Append deep-dive sections after the main report's sections.
    const merged = [...existing, ...deepDive.sections];

    await supabase
      .from("reports")
      .update({
        sections: merged,
        deep_dive_status: "completed",
        deep_dive_focus: deepDive.focus,
      })
      .eq("report_id", reportId);

    return NextResponse.json({
      status: "completed",
      reportId,
      focus: deepDive.focus,
      sections: merged,
      deepDiveSections: deepDive.sections,
    });
  } catch (error) {
    console.error("Master deep-dive error:", error);
    return NextResponse.json({ error: "Failed to generate deep-dive." }, { status: 500 });
  }
}
