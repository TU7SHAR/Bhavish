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

export async function POST(request) {
  try {
    const body = await request.json();

    const parseResult = inputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input: " + parseResult.error.issues[0].message },
        { status: 400 },
      );
    }

    const {
      reportId,
      paymentId,
      name,
      gender,
      dateOfBirth,
      timeOfBirth,
      placeOfBirth,
      chartData,
    } = parseResult.data;

    // Format planetary data for prompt
    const planetaryTable = Object.entries(chartData.planets)
      .map(
        ([planet, data]) =>
          `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`,
      )
      .join("\n");

    const dashaTable = (chartData.dasha || [])
      .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
      .join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const fullPrompt = `You are an expert Vedic astrologer (Jyotishi) with 30+ years of practice.
I have EXACT planetary positions calculated via Swiss Ephemeris (Lahiri Ayanamsa).
INTERPRET these positions. Do NOT recalculate.

═══ BIRTH DATA ═══
Name: ${name} | Gender: ${gender} | DOB: ${dateOfBirth} | Time: ${timeOfBirth} | Place: ${placeOfBirth}

═══ CALCULATED CHART ═══
Ayanamsa: ${chartData.ayanamsa}° (Lahiri)
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree}
Moon Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Lord: ${chartData.nakshatra.ruler}, Deity: ${chartData.nakshatra.deity}
Rashi: ${chartData.rashi}

PLANETS:
${planetaryTable}

DASHA SEQUENCE:
${dashaTable}

═══ GENERATE FULL 20-SECTION REPORT ═══
Each section: 250-350 words. Reference specific planets, houses, degrees from above.

Sections:
1. Rashi (Moon Sign) & Personality Overview
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
17. Remedies & Spiritual Guidance (specific mantras, gems, charity)
18. Lucky Factors (Numbers, Colors, Gems, Days)
19. Monthly Predictions for 2026-2027
20. Life Purpose & Spiritual Path

Format as JSON:
{
  "summary": "2-3 sentences with specific positions",
  "sections": [{ "title": "...", "content": "..." }]
}

Use ${name}'s name throughout. Mix Hindi/Sanskrit with English. Be specific, not generic.
Return ONLY valid JSON.`;

    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text();

    // Fix #4: Robust JSON extraction
    let reportData;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found in response");
      reportData = JSON.parse(match[0]);
    } catch (parseError) {
      console.error("Parse error:", parseError.message);
      return NextResponse.json(
        { error: "Failed to generate full report. Please try again." },
        { status: 500 },
      );
    }

    if (!reportData.sections || reportData.sections.length < 15) {
      return NextResponse.json(
        { error: "Incomplete report. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      reportId,
      paymentId,
      summary: reportData.summary,
      sections: reportData.sections,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Full report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report. Please try again." },
      { status: 500 },
    );
  }
}
