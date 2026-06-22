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
    const prompt = `You are an expert Vedic astrologer (Jyotishi) with 30 years of experience. Generate a detailed, personalized Vedic astrology report based on the following birth details:

Name: ${name}
Gender: ${gender}
Date of Birth: ${dateOfBirth}
Time of Birth: ${timeOfBirth}
Place of Birth: ${placeOfBirth}

Generate a comprehensive 20-section astrology report. Each section should be detailed (200-300 words minimum per section) and HIGHLY PERSONALIZED based on the planetary positions for this specific birth time and place.

Use Vedic astrology principles including:
- Lahiri Ayanamsa for calculations
- Vimshottari Dasha system
- Brihat Parashara Hora Shastra principles
- Nakshatras and their padas

Format the response as a JSON object with the following structure:
{
  "summary": "A 2-3 sentence overview of the person's chart",
  "sections": [
    {
      "title": "Section title",
      "content": "Detailed content for this section"
    }
  ]
}

The 20 sections MUST be:
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
17. Remedies & Spiritual Guidance
18. Lucky Factors (Numbers, Colors, Gems, Days)
19. Monthly Predictions for 2026-2027
20. Life Purpose & Spiritual Path

IMPORTANT RULES:
- Make predictions specific and personalized, not generic
- Use the person's name throughout the report
- Reference specific planetary positions and houses
- Include specific dates/timeframes where relevant
- Be encouraging but honest about challenges
- Provide actionable remedies and advice
- Write in a warm, professional, knowledgeable tone
- Mix Hindi/Sanskrit terms with English explanations

Return ONLY valid JSON. No markdown formatting around it.`;

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
