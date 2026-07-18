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
      existing.some((s) => /deep dive|deep-dive/i.test(s.title || "") || /\b24[- ]month.*roadmap/i.test(s.title || ""));
    if (alreadyHasDeepDive) {
      return NextResponse.json({ status: "already_done", reportId, sections: existing });
    }

    const focus = report.deep_dive_focus || classifyFocus(report.personal_question);

    // Require main report completed before starting deep-dive.
    if (report.report_status !== "completed" || existing.length < 10) {
      return NextResponse.json({
        status: "waiting",
        message: "Main report not yet complete. Deep-dive will start after.",
      }, { status: 202 });
    }

    // ATOMIC CLAIM — inspect `error` field (Supabase doesn't throw on RPC failure).
    let claimed = false;
    const { data: claimData, error: claimErr } = await supabase.rpc("claim_deep_dive_generation", { p_report_id: reportId });
    if (claimErr) {
      // RPC not available — fallback
      if (["generating", "completed"].includes(report.deep_dive_status)) {
        if (report.deep_dive_status === "completed") {
          return NextResponse.json({ status: "already_done", reportId, sections: existing });
        }
        return NextResponse.json({ status: "generating", reportId }, { status: 202 });
      }
      const { data: rows } = await supabase
        .from("reports")
        .update({ deep_dive_status: "generating", deep_dive_focus: focus })
        .eq("report_id", reportId)
        .in("deep_dive_status", ["pending", "failed"])
        .select("report_id");
      claimed = Array.isArray(rows) && rows.length > 0;
    } else {
      claimed = !!claimData;
    }

    if (!claimed) {
      const { data: current } = await supabase.from("reports").select("sections, deep_dive_status").eq("report_id", reportId).single();
      if (current?.deep_dive_status === "completed") {
        return NextResponse.json({ status: "already_done", reportId, sections: current.sections || [] });
      }
      return NextResponse.json({ status: "generating", reportId }, { status: 202 });
    }

    // Set focus after claiming
    await supabase.from("reports").update({ deep_dive_focus: focus }).eq("report_id", reportId);
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

    // NOW send the final email with ALL sections (main + deep-dive).
    // This ensures Master customers receive a complete ₹999 report, not a
    // partial Premium-style one. (Essential/Premium are emailed by fulfillPayment
    // immediately; Master is held until here.)
    if (report.email && report.email.trim()) {
      try {
        const { getInternalAuthHeaders } = await import("../../../lib/auth.js");
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
        const emailRes = await fetch(`${baseUrl}/api/send-report-email`, {
          method: "POST",
          headers: getInternalAuthHeaders(),
          body: JSON.stringify({
            email: report.email,
            name: report.name,
            reportId: report.report_id,
            sections: merged,
            summary: report.summary,
            chartData: report.chart_data,
            dateOfBirth: report.date_of_birth,
            timeOfBirth: report.time_of_birth,
            placeOfBirth: report.place_of_birth,
            includeBump: true,
          }),
        });
        if (emailRes.ok) {
          await supabase.from("reports").update({ email_sent_at: new Date().toISOString() }).eq("report_id", reportId);
        }
      } catch (emailErr) {
        console.error("[deep-dive] Final email send failed:", emailErr.message);
      }
    }

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
