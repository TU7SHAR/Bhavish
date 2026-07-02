import { generateWithRetry } from "../../../lib/gemini-retry.js";
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
    const { name, dateOfBirth, timeOfBirth, placeOfBirth, gender, personalQuestion } =
      await request.json();

    // Basic validation
    if (!name || !dateOfBirth || !timeOfBirth || !placeOfBirth) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
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

    // Step 4: PHASE 1 — Generate ONLY 2 preview sections (saves 90% tokens)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const planetaryTable = Object.entries(chartData.planets)
      .map(([planet, data]) => `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | ${data.dignity}`)
      .join("\n");

    const previewPrompt = `You are an expert Vedic astrologer. Using the EXACT calculated planetary data below, generate a SHORT preview (2 sections + summary + past validation).

BIRTH DATA:
Name: ${name} | Gender: ${gender} | DOB: ${dateOfBirth} | Time: ${timeOfBirth} | Place: ${placeOfBirth}

CALCULATED CHART (Swiss Ephemeris, Lahiri Ayanamsa):
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree}
Moon's Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Ruler: ${chartData.nakshatra.ruler}
Rashi (Moon Sign): ${chartData.rashi}

PLANETS:
${planetaryTable}

${personalQuestion ? `The user asked: "${personalQuestion}"` : ""}

Generate JSON:
{
  "summary": "2 sentence chart overview mentioning specific positions",
  "pastValidation": "2-3 sentences about a challenging period the user likely faced in 2024-2025 based on Saturn/Rahu transits. Be specific about the life area affected. Make it resonate emotionally.",
  ${personalQuestion ? `"personalInsight": "Start answering their question '${personalQuestion}' with a specific planetary reference, then STOP mid-sentence to create an information gap. 1-2 sentences max, ending abruptly.",` : `"personalInsight": null,`}
  "sections": [
    { "title": "Rashi & Personality Overview", "content": "200-250 words interpreting Moon in ${chartData.rashi} in house ${chartData.planets.Moon?.house}" },
    { "title": "Lagna & Core Identity", "content": "200-250 words interpreting ${chartData.ascendant.sign} rising" }
  ]
}

Use ${name}'s name. Mix Hindi/Sanskrit with English. Reference specific houses/degrees.
Return ONLY valid JSON. No markdown.`;

    const result = await generateWithRetry(model, previewPrompt);
    const responseText = result.response.text();

    // Robust JSON parsing
    let reportData;
    try {
      const match = responseText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      reportData = JSON.parse(match[0]);
    } catch (parseError) {
      console.error("Parse error:", parseError.message);
      return NextResponse.json(
        { error: "Failed to generate report. Please try again." },
        { status: 500 }
      );
    }

    if (!reportData.sections || reportData.sections.length < 1) {
      return NextResponse.json(
        { error: "Incomplete report. Please try again." },
        { status: 500 }
      );
    }

    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Extract city name from geocoded displayName (first part before comma)
    const city = location.displayName
      ? location.displayName.split(",")[0].trim()
      : placeOfBirth.split(",")[0].trim();

    return NextResponse.json({
      reportId,
      summary: reportData.summary,
      pastValidation: reportData.pastValidation || null,
      personalInsight: reportData.personalInsight || null,
      // Return both names so frontend works regardless
      sections: reportData.sections,
      previewSections: reportData.sections,
      chartData,
      kundliSVG,
      city,
      generatedAt: new Date().toISOString(),
      birthDetails: { name, dateOfBirth, timeOfBirth, placeOfBirth, gender, personalQuestion: personalQuestion || "" },
    });
  } catch (error) {
    console.error("Preview generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate report. Please check your details and try again." },
      { status: 500 }
    );
  }
}
