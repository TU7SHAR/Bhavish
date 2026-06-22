import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { calculateBirthChart, generateKundliSVG } from "../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../lib/geocode.js";

export async function POST(request) {
  try {
    const { name, dateOfBirth, timeOfBirth, placeOfBirth, gender } =
      await request.json();

    // Validate inputs
    if (!name || !dateOfBirth || !timeOfBirth || !placeOfBirth) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Step 1: Geocode the birth place
    const location = await geocodePlace(placeOfBirth);

    // Step 2: Calculate accurate planetary positions
    const chartData = calculateBirthChart({
      dateOfBirth,
      timeOfBirth,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    // Step 3: Generate Kundli SVG
    const kundliSVG = generateKundliSVG(chartData);

    // Step 4: Build detailed prompt with REAL calculated data for Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    // Format planetary data for the prompt
    const planetaryTable = Object.entries(chartData.planets)
      .map(([planet, data]) => `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`)
      .join("\n");

    const dashaTable = chartData.dasha
      .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
      .join("\n");

    const prompt = `You are an expert Vedic astrologer (Jyotishi) with 30+ years of practice. 
I have already calculated the EXACT planetary positions using Swiss Ephemeris (Lahiri Ayanamsa). 
Your job is to INTERPRET these positions — do NOT recalculate them. Use the data below as absolute truth.

═══════════════════════════════════════
BIRTH DATA:
═══════════════════════════════════════
Name: ${name}
Gender: ${gender}
Date of Birth: ${dateOfBirth}
Time of Birth: ${timeOfBirth}
Place of Birth: ${placeOfBirth} (Lat: ${location.latitude}, Lon: ${location.longitude})

═══════════════════════════════════════
CALCULATED CHART DATA (Swiss Ephemeris):
═══════════════════════════════════════
Ayanamsa Used: ${chartData.ayanamsa}° (Lahiri)
House System: Whole Sign (Rashi-based)

ASCENDANT (Lagna): ${chartData.ascendant.sign} at ${chartData.ascendant.degree}

PLANETARY POSITIONS:
${planetaryTable}

MOON'S NAKSHATRA: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada})
  - Nakshatra Lord: ${chartData.nakshatra.ruler}
  - Deity: ${chartData.nakshatra.deity}

RASHI (Moon Sign): ${chartData.rashi}

VIMSHOTTARI DASHA SEQUENCE (from birth):
${dashaTable}

═══════════════════════════════════════
YOUR TASK:
═══════════════════════════════════════
Using ONLY the calculated data above, generate a detailed 20-section interpretation report.
Each section MUST reference the specific planets, houses, and degrees from the data.
Do NOT invent positions — use what's calculated above.

Format as JSON:
{
  "summary": "2-3 sentences summarizing the chart with specific positions mentioned",
  "pastValidation": "A 2-3 sentence statement about a difficult period the user likely experienced in the last 18-24 months (2024-2025) based on Saturn/Rahu transit through their houses. Be specific about the AREA of life affected (career, health, relationships, finances). Use phrases like 'You likely experienced...' or 'The period between [month] and [month] was particularly challenging for...' This MUST resonate emotionally.",
  "personalInsight": "${personalQuestion ? `A single powerful opening sentence that directly addresses their question: '${personalQuestion}'. Start answering it with precision referencing a specific planet/house, then STOP mid-thought after 1-2 sentences. Leave it unresolved. Example: 'Your 10th lord ${chartData.planets.Saturn?.sign || "Saturn"} in house ${chartData.planets.Saturn?.house || "X"} indicates a clear shift in career trajectory arriving in—' (cut off here). This creates an irresistible information gap.` : "null"}",
  "sections": [
    { "title": "Section title", "content": "250-350 words of detailed interpretation" }
  ]
}

The 20 sections:
1. Rashi (Moon Sign) & Personality — Interpret Moon in ${chartData.rashi} in house ${chartData.planets.Moon.house}
2. Lagna (Ascendant) & Physical Traits — Interpret ${chartData.ascendant.sign} rising
3. Sun Sign & Core Identity — Interpret Sun in ${chartData.planets.Sun.sign} in house ${chartData.planets.Sun.house}
4. Nakshatra (Birth Star) Analysis — Deep dive into ${chartData.nakshatra.name} Pada ${chartData.nakshatra.pada}
5. Planetary Positions & Strengths — Summarize all 9 planets with dignities
6. Career & Professional Life — 10th house analysis + 10th lord
7. Wealth & Financial Prospects — 2nd and 11th house + Dhana yogas
8. Marriage & Love Life — 7th house + Venus placement + Navamsha hints
9. Family & Relationships — 4th house (mother), 9th (father), 3rd (siblings)
10. Health & Physical Wellbeing — 6th house + Lagna lord strength
11. Education & Intellectual Growth — 4th, 5th house + Mercury/Jupiter
12. Current Mahadasha Analysis — Based on dasha sequence, estimate current period for someone born ${dateOfBirth}
13. Upcoming Dasha Predictions (Next 5 Years) — Transitions and predictions
14. Manglik Dosha Analysis — Check Mars position from Lagna and Moon
15. Kaal Sarp & Other Yoga Analysis — Check Rahu-Ketu axis, named yogas
16. Favorable & Unfavorable Periods — Based on transits and dashas
17. Remedies & Spiritual Guidance — Specific mantras, gems, charity based on weak planets
18. Lucky Factors — Numbers, colors, gems, days based on Lagna lord and Moon lord
19. Monthly Predictions for 2026-2027 — Based on current Jupiter/Saturn/Rahu transit
20. Life Purpose & Spiritual Path — 9th, 12th house + Atmakaraka

TONE: Warm, professional, use ${name}'s name, mix Hindi/Sanskrit terms with English explanations.
Return ONLY valid JSON. No markdown. No code blocks.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let reportData;
    try {
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      reportData = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      console.error("Raw response:", responseText.substring(0, 500));
      return NextResponse.json(
        { error: "Failed to generate report. Please try again." },
        { status: 500 }
      );
    }

    if (!reportData.sections || reportData.sections.length < 10) {
      return NextResponse.json(
        { error: "Incomplete report generated. Please try again." },
        { status: 500 }
      );
    }

    // Generate unique report ID
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      pastValidation: reportData.pastValidation || null,
      personalInsight: reportData.personalInsight || null,
      sections: reportData.sections,
      chartData, // Send calculated chart data to frontend
      kundliSVG, // Send SVG chart
      generatedAt: new Date().toISOString(),
      birthDetails: { name, dateOfBirth, timeOfBirth, placeOfBirth, gender },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report. Please check your details and try again." },
      { status: 500 }
    );
  }
}
