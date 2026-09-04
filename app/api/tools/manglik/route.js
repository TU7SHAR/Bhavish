import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodePlace } from "../../../../lib/geocode.js";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { previewLimiter } from "../../../../lib/rate-limit.js";

// Free Manglik (Mangal Dosha) calculator API.
//
// Reuses the SAME deterministic engine as the paid report (geocode →
// calculateBirthChart → chartData.manglik), so the free tool and the paid
// report can never disagree on a person's Manglik status.
//
// This endpoint is intentionally lightweight: it does NOT call Gemini, does
// NOT save a lead, and returns only the Manglik verdict + the Mars house
// positions that produced it. The full interpretation is the paywalled report.
export const maxDuration = 30;

const inputSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
  timeOfBirth: z.string().regex(/^\d{2}:\d{2}$/, "Time of birth must be HH:MM"),
  placeOfBirth: z.string().min(2, "Place of birth is required").max(120),
});

export async function POST(request) {
  try {
    // Rate limit (reuse the AI-generation tier: 3/min/IP). This tool is cheap
    // but still hits the geocoder, so we protect it the same way.
    const rateCheck = await previewLimiter(request);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.error }, { status: 429 });
    }

    const raw = await request.json();
    let input;
    try {
      input = inputSchema.parse(raw);
    } catch (e) {
      const msg = e?.issues?.[0]?.message || "Invalid input";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Basic date sanity: not in the future, not before 1920.
    const dob = new Date(`${input.dateOfBirth}T00:00:00Z`);
    const year = dob.getUTCFullYear();
    if (Number.isNaN(dob.getTime()) || year < 1920 || dob > new Date()) {
      return NextResponse.json(
        { error: "Please enter a valid date of birth (not in the future, not before 1920)." },
        { status: 400 }
      );
    }

    // Geocode → chart. Same path the paid preview uses.
    const geo = await geocodePlace(input.placeOfBirth);
    const chart = calculateBirthChart({
      dateOfBirth: input.dateOfBirth,
      timeOfBirth: input.timeOfBirth,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezoneOffsetMinutes: geo.timezoneOffsetMinutes,
    });

    const manglik = chart.manglik || {};

    return NextResponse.json({
      isManglik: !!manglik.isManglik,
      summary: manglik.summary || "",
      // Mars house positions from the three reference points that define the dosha.
      references: manglik.references || null,
      // Light chart context so the result feels grounded (no full report given away).
      context: {
        ascendant: chart?.ascendant?.sign || null,
        rashi: chart?.rashi || null,
        marsSign: chart?.planets?.Mars?.sign || null,
        place: geo.displayName || input.placeOfBirth,
      },
    });
  } catch (error) {
    console.error("[tools/manglik] error:", error.message);
    return NextResponse.json(
      { error: "Could not calculate right now. Please try again." },
      { status: 500 }
    );
  }
}
