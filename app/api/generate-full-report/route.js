import { generateWithRetry } from "../../../lib/gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Fix #1: Allow up to 60 seconds for full report generation on Vercel
export const maxDuration = 60;
import { z } from "zod";

// Fix #2: This is PHASE 2 — only called AFTER payment is verified
// Fix #1: Full 20-section generation only happens after payment = no token waste

const inputSchema = z.object({
  reportId: z.string().min(1),
  paymentId: z.string().min(1),
  name: z.string().min(2).max(100),
  gender: z.enum(["male", "female", "other"]),
  dateOfBirth: z.string(),
  timeOfBirth: z.string(),
  placeOfBirth: z.string(),
  chartData: z.object({
    ascendant: z.any(),
    planets: z.any(),
    nakshatra: z.any(),
    rashi: z.any(),
    dasha: z.any(),
    ayanamsa: z.any(),
  }),
});

// PHASE 2 — Full 20-section report, only called AFTER payment is verified
export async function POST(request) {
  try {
    const { reportId, name, gender, dateOfBirth, timeOfBirth, placeOfBirth, chartData, personalQuestion } =
      await request.json();

    if (!reportId || !name || !chartData) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const planetaryTable = Object.entries(chartData.planets)
      .map(([planet, data]) => `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`)
      .join("\n");

    const dashaTable = (chartData.dasha || [])
      .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
      .join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const fullPrompt = `You are an expert Vedic astrologer (Jyotishi). Interpret these EXACT calculated positions (Swiss Ephemeris, Lahiri Ayanamsa). Do NOT recalculate.

BIRTH DATA: ${name} | ${gender} | ${dateOfBirth} | ${timeOfBirth} | ${placeOfBirth}

CHART:
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree}
Moon Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Lord: ${chartData.nakshatra.ruler}
Rashi: ${chartData.rashi}

PLANETS:
${planetaryTable}

DASHA SEQUENCE (from birth):
${dashaTable}

CURRENT DASHA (USE THIS EXACTLY — do NOT guess or recalculate):
${chartData.dashaTimeline?.summary || "Not available"}
IMPORTANT: In Section 12 (Current Mahadasha) and Section 13 (Upcoming Dasha), you MUST use the CURRENT DASHA stated above. Do not infer the period from age. The person is currently in the Mahadasha stated above.

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
      console.error("Parse error:", parseError.message);
      return NextResponse.json(
        { error: "Failed to generate full report. Please try again." },
        { status: 500 }
      );
    }

    if (!reportData.sections || reportData.sections.length < 15) {
      return NextResponse.json(
        { error: "Incomplete report. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      sections: reportData.sections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Full report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report. Please try again." },
      { status: 500 }
    );
  }
}
