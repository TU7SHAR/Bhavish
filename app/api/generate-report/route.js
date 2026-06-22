import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { name, dateOfBirth, timeOfBirth, placeOfBirth, gender } =
      await request.json();

    // Validate inputs
    if (!name || !dateOfBirth || !timeOfBirth || !placeOfBirth) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    // Initialize inside handler (not at module level)
    // so it doesn't crash during build when env vars aren't available
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    // Generate the full report prompt
    const prompt = `You are an expert Vedic astrologer (Jyotishi) with 30+ years of practice. You MUST calculate accurate planetary positions using Lahiri Ayanamsa for the given birth data.

BIRTH DATA:
- Name: ${name}
- Gender: ${gender}
- Date of Birth: ${dateOfBirth}
- Time of Birth: ${timeOfBirth} (24hr format)
- Place of Birth: ${placeOfBirth}

CRITICAL INSTRUCTIONS:
1. FIRST, calculate the EXACT astronomical positions:
   - Determine the latitude/longitude of "${placeOfBirth}"
   - Calculate the Lagna (Ascendant) based on exact time and location
   - Determine Moon sign (Rashi) based on Moon's sidereal position at birth time
   - Calculate all 9 planets (Surya, Chandra, Mangal, Budh, Guru, Shukra, Shani, Rahu, Ketu) positions in signs and houses
   - Determine the Nakshatra and Pada of the Moon

2. THEN generate predictions BASED ON those specific positions. Do NOT write generic zodiac-sign-level content.

3. Every section MUST include:
   - Specific planet names in specific houses (e.g., "Your Mars is in the 7th house in Tula rashi")
   - Specific degree references where possible
   - House lordship analysis (e.g., "As your 10th lord Saturn sits in the 3rd house...")
   - Specific Dasha calculations based on Moon's Nakshatra
   - Named Yogas with the exact planets forming them

4. DO NOT:
   - Write generic sun-sign-level predictions
   - Use vague language like "you may" or "there could be" without planetary basis
   - Give the same report you'd give anyone with just the same sun sign
   - Skip the mathematical basis — show the planetary logic behind every prediction

5. FORMAT: Return a JSON object:
{
  "summary": "2-3 sentences with SPECIFIC planetary positions mentioned",
  "sections": [
    { "title": "Section title", "content": "Detailed content (250-350 words)" }
  ]
}

The 20 sections MUST be:
1. Rashi (Moon Sign) & Personality Overview — Include exact Moon position, degree, Nakshatra pada
2. Lagna (Ascendant) & Physical Traits — Exact Lagna degree, Lagna lord position, aspects on Lagna
3. Sun Sign & Core Identity — Sun's house and sign, aspects received, Sun's Nakshatra
4. Nakshatra (Birth Star) Analysis — Moon's Nakshatra, deity, ruling planet, pada characteristics
5. Planetary Positions & Strengths — ALL 9 planets: sign, house, dignity (exalted/debilitated/own/friend/enemy), and Shadbala summary
6. Career & Professional Life — 10th house lord, planets in 10th, Dashamsha analysis, specific career fields
7. Wealth & Financial Prospects — 2nd and 11th house analysis, Dhana yogas if present, timing of wealth
8. Marriage & Love Life — 7th house, Venus placement, Navamsha analysis, timing of marriage
9. Family & Relationships — 4th house (mother), 9th house (father), 3rd house (siblings), specific dynamics
10. Health & Physical Wellbeing — 6th house, 8th house, Lagna lord strength, specific body areas at risk
11. Education & Intellectual Growth — 4th, 5th house analysis, Mercury/Jupiter roles, fields of excellence
12. Current Mahadasha Analysis — Calculate current Vimshottari Dasha from Moon's Nakshatra, exact start/end dates
13. Upcoming Dasha Predictions (Next 5 Years) — Specific Antardasha transitions with dates and predictions
14. Manglik Dosha Analysis — Check Mars in 1,4,7,8,12 from Lagna AND Moon, severity assessment
15. Kaal Sarp & Other Yoga Analysis — Check Rahu-Ketu axis, all planets' placement relative to them, other Raja/Dhana/Viparita yogas
16. Favorable & Unfavorable Periods — Specific months in 2026-2027 that are good/bad based on Gochar
17. Remedies & Spiritual Guidance — Specific mantras with counts, gemstones with weight, charity items, fasting days
18. Lucky Factors (Numbers, Colors, Gems, Days) — Based on Lagna lord and Moon sign lord specifically
19. Monthly Predictions for 2026-2027 — Each month briefly with key transit effects (Jupiter, Saturn, Rahu transits)
20. Life Purpose & Spiritual Path — 9th house, 12th house, Atmakaraka planet analysis

TONE: Warm but authoritative. Use the person's name. Mix Hindi/Sanskrit terms with clear English explanations.

Return ONLY valid JSON. No markdown. No code blocks.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse the JSON response (handle potential markdown wrapping)
    let reportData;
    try {
      // Remove potential markdown code block wrapping
      const cleaned = responseText
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();
      reportData = JSON.parse(cleaned);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError);
      return NextResponse.json(
        { error: "Failed to generate report. Please try again." },
        { status: 500 },
      );
    }

    // Validate the response has the expected structure
    if (!reportData.sections || reportData.sections.length < 10) {
      return NextResponse.json(
        { error: "Incomplete report generated. Please try again." },
        { status: 500 },
      );
    }

    // Generate a unique report ID
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      sections: reportData.sections,
      generatedAt: new Date().toISOString(),
      birthDetails: { name, dateOfBirth, timeOfBirth, placeOfBirth, gender },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to generate report. Please check your details and try again.",
      },
      { status: 500 },
    );
  }
}
