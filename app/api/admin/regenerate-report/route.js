import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { generateWithRetry } from "../../../../lib/gemini-retry.js";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../../lib/geocode.js";

// Admin endpoint: regenerate a customer's FULL report from scratch.
// Recalculates the chart from birth details, then generates all 20 sections.
// POST /api/admin/regenerate-report
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId }
export const maxDuration = 60;

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reportId } = await request.json();
    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Fetch the report's birth details
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

    // Step 1: Geocode the birth place
    const location = await geocodePlace(report.place_of_birth);

    // Step 2: Recalculate the birth chart
    const chartData = calculateBirthChart({
      dateOfBirth: report.date_of_birth,
      timeOfBirth: report.time_of_birth,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    // Step 3: Build the full report prompt
    const planetaryTable = Object.entries(chartData.planets)
      .map(([planet, data]) => `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`)
      .join("\n");
    const dashaTable = (chartData.dasha || [])
      .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
      .join("\n");

    const personalQuestion = report.personal_question || "";
    const name = report.name;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const fullPrompt = `You are an expert Vedic astrologer (Jyotishi). Interpret these EXACT calculated positions (Swiss Ephemeris, Lahiri Ayanamsa). Do NOT recalculate.

BIRTH DATA: ${name} | ${report.gender} | ${report.date_of_birth} | ${report.time_of_birth} | ${report.place_of_birth}

CHART:
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree}
Moon Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Lord: ${chartData.nakshatra.ruler}
Rashi: ${chartData.rashi}

PLANETS:
${planetaryTable}

DASHA:
${dashaTable}

Generate a 20-section report. Each section 250-350 words referencing specific planets/houses/degrees.

Format JSON:
{
  "summary": "2-3 sentences with specific positions",
  "sections": [{ "title": "...", "content": "..." }]
}

Sections:
1. Rashi (Moon Sign) & Personality
2. Lagna (Ascendant) & Physical Traits
3. Sun Sign & Core Identity
4. Nakshatra (Birth Star) Analysis
5. Planetary Positions & Strengths
6. Career & Professional Life
7. Wealth & Financial Prospects
8. Marriage & Love Life
9. Family & Relationships
10. Health & Physical Wellbeing
11. Education & Intellectual Growth
12. Current Mahadasha Analysis
13. Upcoming Dasha Predictions (Next 5 Years)
14. Manglik Dosha Analysis
15. Kaal Sarp & Other Yoga Analysis
16. Favorable & Unfavorable Periods
17. Remedies & Spiritual Guidance
18. Lucky Factors (Numbers, Colors, Gems, Days)
19. Monthly Predictions for 2026-2027
20. Life Purpose & Spiritual Path${personalQuestion ? `\n21. Personal Concern: Answer "${personalQuestion}" using relevant houses/planets/transits. Be specific about timing.` : ""}

Use ${name}'s name. Mix Hindi/Sanskrit with English. Return ONLY valid JSON.`;

    const result = await generateWithRetry(model, fullPrompt);
    const responseText = result.response.text();

    let reportData;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      reportData = JSON.parse(match[0]);
    } catch (parseError) {
      return NextResponse.json({ error: "AI returned invalid format. Try again." }, { status: 500 });
    }

    if (!reportData.sections || reportData.sections.length < 15) {
      return NextResponse.json({ error: `Only ${reportData.sections?.length || 0} sections generated. Try again.` }, { status: 500 });
    }

    // Step 4: Save the regenerated report to DB
    const { error: updateErr } = await supabase
      .from("reports")
      .update({
        summary: reportData.summary,
        sections: reportData.sections,
      })
      .eq("report_id", reportId);

    if (updateErr) {
      return NextResponse.json({ error: "Report generated but DB save failed: " + updateErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      reportId,
      sectionCount: reportData.sections.length,
    });
  } catch (error) {
    console.error("regenerate-report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
