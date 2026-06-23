import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculateBirthChart, generateKundliSVG } from "../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../lib/geocode.js";

// Allow up to 30 seconds for preview generation on Vercel
export const maxDuration = 30;

// Fix #6: Input validation with Zod
const inputSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  timeOfBirth: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format (HH:MM)"),
  placeOfBirth: z.string().min(2).max(200).trim(),
  gender: z.enum(["male", "female", "other"]),
  email: z.string().email().optional().or(z.literal("")),
});

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate input
    const parseResult = inputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid input: " + parseResult.error.issues[0].message },
        { status: 400 },
      );
    }

    const { name, dateOfBirth, timeOfBirth, placeOfBirth, gender } =
      parseResult.data;

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

    // Step 4: PHASE 1 — Generate ONLY the preview (1-2 sections, not all 20)
    // This saves ~90% of token costs for users who don't pay
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });
    // Format planetary data
    const planetaryTable = Object.entries(chartData.planets)
      .map(
        ([planet, data]) =>
          `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`,
      )
      .join("\n");

    const previewPrompt = `You are an expert Vedic astrologer. Using the EXACT calculated planetary data below, generate a SHORT preview report (2 sections only).

BIRTH DATA:
Name: ${name} | Gender: ${gender} | DOB: ${dateOfBirth} | Time: ${timeOfBirth} | Place: ${placeOfBirth}

CALCULATED CHART (Swiss Ephemeris, Lahiri Ayanamsa):
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree}
Moon's Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Ruler: ${chartData.nakshatra.ruler}
Rashi (Moon Sign): ${chartData.rashi}

PLANETS:
${planetaryTable}

Generate ONLY these 2 sections (keep each 200-250 words):
1. "Rashi & Personality Overview" — Interpret Moon in ${chartData.rashi} in house ${chartData.planets.Moon?.house}
2. "Lagna & Core Identity" — Interpret ${chartData.ascendant.sign} rising with Lagna lord placement

Also generate a 2-sentence chart summary mentioning specific positions.

Format as JSON:
{
  "summary": "2 sentence chart overview with specific positions",
  "sections": [
    { "title": "...", "content": "..." },
    { "title": "...", "content": "..." }
  ]
}

Use ${name}'s name. Mix Hindi/Sanskrit terms with English. Reference specific houses and degrees.
Return ONLY valid JSON.`;

    const result = await model.generateContent(previewPrompt);
    const responseText = result.response.text();

    // Fix #4: Robust JSON parsing
    let reportData;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON object found in response");
      reportData = JSON.parse(match[0]);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError.message);
      console.error(
        "Raw response (first 300 chars):",
        responseText.substring(0, 300),
      );
      return NextResponse.json(
        { error: "Failed to generate report. Please try again." },
        { status: 500 },
      );
    }

    if (!reportData.sections || reportData.sections.length < 1) {
      return NextResponse.json(
        { error: "Incomplete report generated. Please try again." },
        { status: 500 },
      );
    }

    // Generate unique report ID
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      previewSections: reportData.sections, // Only 2 sections for preview
      chartData,
      kundliSVG,
      generatedAt: new Date().toISOString(),
      birthDetails: { name, dateOfBirth, timeOfBirth, placeOfBirth, gender },
    });
  } catch (error) {
    console.error("Preview generation error:", error);
    return NextResponse.json(
      {
        error:
          "Failed to generate report. Please check your details and try again.",
      },
      { status: 500 },
    );
  }
}
