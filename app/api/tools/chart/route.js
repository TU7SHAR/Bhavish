import { NextResponse } from "next/server";
import { z } from "zod";
import { geocodePlace } from "../../../../lib/geocode.js";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { luckyFactorsForAscendant } from "../../../../lib/lucky-factors.js";
import { previewLimiter } from "../../../../lib/rate-limit.js";

// Shared free-tool API. Runs the SAME deterministic engine as the paid report
// and returns the pieces the lightweight /tools/* calculators display. No
// Gemini, no saved lead — the full interpretation stays behind the paywall.
//
// POST /api/tools/chart
// Body: { dateOfBirth, timeOfBirth, placeOfBirth }
// Returns: { rashi, nakshatra, kaalSarp, dasha, lucky, context }
export const maxDuration = 30;

const inputSchema = z.object({
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
  timeOfBirth: z.string().regex(/^\d{2}:\d{2}$/, "Time of birth must be HH:MM"),
  placeOfBirth: z.string().min(2, "Place of birth is required").max(120),
});

export async function POST(request) {
  try {
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

    const dob = new Date(`${input.dateOfBirth}T00:00:00Z`);
    const year = dob.getUTCFullYear();
    if (Number.isNaN(dob.getTime()) || year < 1920 || dob > new Date()) {
      return NextResponse.json(
        { error: "Please enter a valid date of birth (not in the future, not before 1920)." },
        { status: 400 }
      );
    }

    const geo = await geocodePlace(input.placeOfBirth);
    const chart = calculateBirthChart({
      dateOfBirth: input.dateOfBirth,
      timeOfBirth: input.timeOfBirth,
      latitude: geo.latitude,
      longitude: geo.longitude,
      timezoneOffsetMinutes: geo.timezoneOffsetMinutes,
    });

    const lucky = luckyFactorsForAscendant(chart?.ascendant?.signIndex || 1);
    const ks = chart?.yogas?.kaalSarp || null; // { present, type }

    return NextResponse.json({
      // Rashi / Moon sign
      rashi: chart?.rashi || null,
      // Nakshatra (name, pada, ruler)
      nakshatra: chart?.nakshatra
        ? { name: chart.nakshatra.name, pada: chart.nakshatra.pada, ruler: chart.nakshatra.ruler }
        : null,
      // Kaal Sarp Dosha
      kaalSarp: {
        present: !!ks?.present,
        type: ks?.type || null,
        summary: ks?.present
          ? `Kaal Sarp Yoga is PRESENT (${ks.type} type) — all seven planets fall on one side of the Rahu–Ketu axis.`
          : "Kaal Sarp Yoga is ABSENT — the seven planets fall on both sides of the Rahu–Ketu axis.",
      },
      // Current Vimshottari Dasha / Antardasha
      dasha: chart?.dashaTimeline
        ? {
            mahadasha: chart.dashaTimeline.currentMahadasha,
            mahadashaStart: chart.dashaTimeline.currentMahadashaStart,
            mahadashaEnd: chart.dashaTimeline.currentMahadashaEnd,
            antardasha: chart.dashaTimeline.currentAntardasha,
            antardashaEnd: chart.dashaTimeline.currentAntardashaEnd,
          }
        : null,
      // Lucky factors (from Ascendant lord)
      lucky,
      // Light context so results feel grounded (no full report given away).
      context: {
        ascendant: chart?.ascendant?.sign || null,
        moonSign: chart?.rashi || null,
        place: geo.displayName || input.placeOfBirth,
      },
    });
  } catch (error) {
    console.error("[tools/chart] error:", error.message);
    return NextResponse.json({ error: "Could not calculate right now. Please try again." }, { status: 500 });
  }
}
