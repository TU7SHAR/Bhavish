import { generateWithRetry } from "./gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeForPrompt } from "./sanitize.js";

/**
 * Shared full-report generation logic.
 *
 * Used by BOTH:
 *  - /api/generate-full-report (browser flow, after client-side payment verify)
 *  - /api/razorpay-webhook + reconciliation (server-side, when the browser
 *    callback never fired — e.g. UPI users who close the tab after paying)
 *
 * Keeping this in a plain function (no HTTP, no rate limiter) lets the
 * server-side payment fulfilment path generate reports directly without
 * hitting the public route's IP-based rate limit.
 *
 * @returns {Promise<{ summary: string, sections: Array<{title,content}> }>}
 * @throws {Error} with a user-safe message on parse failure / quality gate fail
 */
export async function generateFullReport({
  name,
  gender,
  dateOfBirth,
  timeOfBirth,
  placeOfBirth,
  chartData,
  personalQuestion,
  includeBump,
}) {
  if (!name || !chartData) {
    throw new Error("Missing required fields for report generation");
  }

  const planetaryTable = Object.entries(chartData.planets)
    .map(
      ([planet, data]) =>
        `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | Navamsa D9: ${data.navamsa} | ${data.dignity}`
    )
    .join("\n");

  // Lucky factors (pre-computed from ascendant lord) — must be used in Section 18
  const signGems = {
    1: { gem: "Red Coral", color: "Red", lucky: "9, 1, 3", day: "Tuesday" },
    2: { gem: "Diamond", color: "White", lucky: "6, 2, 7", day: "Friday" },
    3: { gem: "Emerald", color: "Green", lucky: "5, 3, 8", day: "Wednesday" },
    4: { gem: "Pearl", color: "White/Silver", lucky: "2, 7, 9", day: "Monday" },
    5: { gem: "Ruby", color: "Gold/Orange", lucky: "1, 4, 9", day: "Sunday" },
    6: { gem: "Emerald", color: "Green", lucky: "5, 3, 6", day: "Wednesday" },
    7: { gem: "Diamond", color: "White/Pink", lucky: "6, 7, 2", day: "Friday" },
    8: { gem: "Red Coral", color: "Dark Red", lucky: "9, 1, 8", day: "Tuesday" },
    9: { gem: "Yellow Sapphire", color: "Yellow", lucky: "3, 9, 5", day: "Thursday" },
    10: { gem: "Blue Sapphire", color: "Blue/Black", lucky: "8, 4, 6", day: "Saturday" },
    11: { gem: "Blue Sapphire", color: "Blue", lucky: "8, 4, 7", day: "Saturday" },
    12: { gem: "Yellow Sapphire", color: "Yellow", lucky: "3, 9, 7", day: "Thursday" },
  };
  const signIdx = chartData.ascendant.signIndex || 1;
  const luckyFactors = signGems[signIdx] || signGems[1];

  const dashaTable = (chartData.dasha || [])
    .map((d, i) => `${i + 1}. ${d.planet} Mahadasha: ${d.years} years`)
    .join("\n");

  // Sanitize personalQuestion to prevent prompt injection
  const safeQuestion = sanitizeForPrompt(personalQuestion, 300);

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
18. Lucky Factors (Numbers, Colors, Gems, Days) — IMPORTANT: You MUST use these exact primary lucky factors (computed from Ascendant Lord): Primary Gem = ${luckyFactors.gem}, Primary Color = ${luckyFactors.color}, Primary Numbers = ${luckyFactors.lucky}, Primary Day = ${luckyFactors.day}. You may add secondary factors from Moon sign or strongest planet, but the PRIMARY factors listed here must appear first and must not be contradicted.
19. Monthly Predictions for 2026-2027
20. Life Purpose & Spiritual Path${safeQuestion ? `\n21. Personal Concern: Answer "${safeQuestion}" using relevant houses/planets/transits. Be specific about timing.` : ""}${includeBump ? `\n${safeQuestion ? "22" : "21"}. 12-Month Personal Guidance Pack — THIS IS A PAID ADD-ON THE CUSTOMER PURCHASED. Make it substantial (500-700 words). Include ALL of: (a) a brief month-by-month forecast for the next 12 months covering career, money, love, and health each month; (b) which months are BEST for action/decisions and which are CAUTION months; (c) key timing windows (e.g. "good for career movement", "avoid impulsive spending", "focus on health", "relationship clarity period"); (d) a simple practical monthly action plan; (e) safe personal remedies/suggestions (journaling, meditation, discipline, charity, mantra); (f) a final 12-month yearly-theme summary. Anchor timing to the computed dasha/antardasha above.` : ""}

Use ${name}'s name. Mix Hindi/Sanskrit with English. Return ONLY valid JSON.`;

  const result = await generateWithRetry(model, fullPrompt);
  const responseText = result.response.text();

  let reportData;
  try {
    const match = responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON found");
    reportData = JSON.parse(match[0]);
  } catch (parseError) {
    console.error("Report parse error:", parseError.message);
    throw new Error("Failed to generate full report. Please try again.");
  }

  // Quality gate: enough sections, and the paid guidance section must exist if bought
  const hasGuidanceSection =
    Array.isArray(reportData.sections) &&
    reportData.sections.some((s) => /guidance pack|12-month/i.test(s.title || ""));
  if (
    !reportData.sections ||
    reportData.sections.length < 15 ||
    (includeBump && !hasGuidanceSection)
  ) {
    throw new Error("Incomplete report. Please try again.");
  }

  return {
    summary: reportData.summary,
    sections: reportData.sections,
  };
}
