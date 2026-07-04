import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { generateWithRetry } from "../../../../lib/gemini-retry.js";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../../lib/geocode.js";

// Founder-only: generate a FREE full report (no payment).
// The logged-in user must be a verified founder member.
// POST /api/founder/generate
// Body: { name, gender, dateOfBirth, timeOfBirth, placeOfBirth, personalQuestion }
export const maxDuration = 60;

// 0 = unlimited. Set to e.g. 1 for "1 free report per month".
const FOUNDER_MONTHLY_LIMIT = parseInt(process.env.FOUNDER_MONTHLY_LIMIT || "0", 10);

export async function POST(request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    // Must be logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    // Verify founder: any report linked to this user (by id or email) with is_founder_member
    const { data: founderReports } = await supabase
      .from("reports")
      .select("report_id, is_founder_member")
      .or(`user_id.eq.${user.id},email.eq.${user.email}`)
      .eq("is_founder_member", true)
      .limit(1);

    if (!founderReports || founderReports.length === 0) {
      return NextResponse.json({ error: "This feature is for Founder Members only." }, { status: 403 });
    }

    // Monthly quota check (if a limit is set)
    if (FOUNDER_MONTHLY_LIMIT > 0) {
      const startOfMonth = new Date();
      startOfMonth.setUTCDate(1);
      startOfMonth.setUTCHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("reports")
        .select("report_id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_founder_free", true)
        .gte("created_at", startOfMonth.toISOString());
      if ((count || 0) >= FOUNDER_MONTHLY_LIMIT) {
        return NextResponse.json({ error: `You've used your ${FOUNDER_MONTHLY_LIMIT} free report(s) this month. Resets next month.` }, { status: 429 });
      }
    }

    const { name, gender, dateOfBirth, timeOfBirth, placeOfBirth, personalQuestion } = await request.json();
    if (!name || !dateOfBirth || !timeOfBirth || !placeOfBirth) {
      return NextResponse.json({ error: "All birth details are required." }, { status: 400 });
    }

    // Geocode + calculate chart
    const location = await geocodePlace(placeOfBirth);
    const chartData = calculateBirthChart({
      dateOfBirth,
      timeOfBirth,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    const planetaryTable = Object.entries(chartData.planets)
      .map(([planet, data]) => `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | Navamsa D9: ${data.navamsa} | ${data.dignity}`)
      .join("\n");
    const dashaTable = (chartData.dasha || [])
      .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
      .join("\n");

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const fullPrompt = `You are an expert Vedic astrologer (Jyotishi). Interpret these EXACT calculated positions (Swiss Ephemeris, Lahiri Ayanamsa). Do NOT recalculate.

BIRTH DATA: ${name} | ${gender} | ${dateOfBirth} | ${timeOfBirth} | ${placeOfBirth}

CHART:
Ascendant: ${chartData.ascendant.sign} at ${chartData.ascendant.degree} | Navamsa D9: ${chartData.ascendant.navamsa}
Moon Nakshatra: ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada}), Lord: ${chartData.nakshatra.ruler}
Rashi: ${chartData.rashi}

PLANETS:
${planetaryTable}

DASHA SEQUENCE (from birth):
${dashaTable}

CURRENT DASHA (USE THIS EXACTLY — do NOT guess or recalculate):
${chartData.dashaTimeline?.summary || "Not available"}
CRITICAL TIMELINE INSTRUCTION: The Mahadasha/Antardasha period stated above is a HARD FACT computed from the Moon's exact birth degree — treat it as ground truth. You MUST use this exact running period and its dates in Sections 12, 13, 16, 19, and 21. You are strictly forbidden from calculating, inferring, or guessing the current dasha from the person's age or from the dasha sequence years. Every timeline-based prediction in those sections must be anchored to the period stated above.

NAVAMSA (D9) INSTRUCTION: Each planet's and the Ascendant's Navamsa (D9) sign is listed above as a HARD FACT. The Nakshatra pada's navamsa equals the Moon's Navamsa (D9) sign shown above. Whenever you reference a navamsa (e.g. Section 4), you MUST use these exact D9 signs and are strictly forbidden from computing or guessing any navamsa yourself.

MANGLIK (MANGAL DOSHA) STATUS (computed — USE EXACTLY): ${chartData.manglik?.summary || "Not available"}
MANGLIK INSTRUCTION: In Section 14 you MUST use the Manglik verdict and reasoning stated above. Do NOT decide Manglik status yourself or invent which house triggers it — Manglik houses are only 1, 2, 4, 7, 8, and 12 (never the 9th).

YOGAS (computed — USE EXACTLY): ${chartData.yogas?.summary || "Not available"}
YOGA INSTRUCTION: In Section 15 (Kaal Sarp & Other Yoga Analysis) you MUST use the exact Kaal Sarp verdict and the exact list of yogas stated above. If Kaal Sarp is ABSENT, clearly state it is absent — never claim a full or partial Kaal Sarp. Do NOT invent, add, or imply any yoga that is not in the list above, and do NOT contradict it. Only describe the yogas listed.

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
    } catch {
      return NextResponse.json({ error: "AI returned invalid format. Please try again." }, { status: 500 });
    }

    if (!reportData.sections || reportData.sections.length < 15) {
      return NextResponse.json({ error: "Report generation incomplete. Please try again." }, { status: 500 });
    }

    // Save as a free founder report linked to the user
    const reportId = `RPT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const insertData = {
      report_id: reportId,
      user_id: user.id,
      name,
      email: user.email,
      gender,
      date_of_birth: dateOfBirth,
      time_of_birth: timeOfBirth,
      place_of_birth: placeOfBirth,
      summary: reportData.summary,
      sections: reportData.sections,
      chart_data: chartData, // kundli charts, planet table, lucky factors, remedies
      payment_status: "founder", // free founder generation — NOT paid revenue
      personal_question: personalQuestion || null,
    };

    // Try with is_founder_free flag; fall back if column doesn't exist
    let { error: insertErr } = await supabase.from("reports").insert({ ...insertData, is_founder_free: true });
    if (insertErr) {
      // Retry without is_founder_free
      const retry = await supabase.from("reports").insert(insertData);
      insertErr = retry.error;
      // If still failing (e.g. chart_data column missing), retry without it too
      if (insertErr) {
        const { chart_data, ...withoutChart } = insertData;
        const retry2 = await supabase.from("reports").insert(withoutChart);
        insertErr = retry2.error;
      }
    }

    if (insertErr) {
      return NextResponse.json({ error: "Report generated but save failed: " + insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, reportId });
  } catch (error) {
    console.error("founder generate error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
