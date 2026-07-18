import { generateWithRetry } from "./gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeForPrompt } from "./sanitize.js";

/**
 * Shared, TIER-AWARE full-report generation.
 *
 * Used by BOTH:
 *  - /api/generate-full-report (browser flow, after client-side payment verify)
 *  - /api/razorpay-webhook + reconciliation (server-side fulfillment)
 *
 * Tiers (see lib/plans.js):
 *  - essential → 10 core sections + personal answer (+ guidance if purchased)
 *  - premium   → 20 core sections + personal answer + 12-month guidance
 *  - master    → same 20-core main report as Premium; the concern-specific
 *                7-section deep-dive + 24-month roadmap is generated SEPARATELY
 *                by /api/generate-master-deep-dive (kept off this request to
 *                respect the 60s serverless timeout).
 *
 * @returns {Promise<{ summary: string, sections: Array<{title,content}> }>}
 * @throws {Error} with a user-safe message on parse failure / quality gate fail
 */

// Essential: the 10 core sections (outcomes, not filler).
const ESSENTIAL_SECTIONS = [
  "Rashi (Moon Sign) & Personality",
  "Lagna (Ascendant) & Core Identity",
  "Career & Professional Direction",
  "Money & Financial Outlook",
  "Love & Marriage",
  "Health & Wellbeing",
  "Current Mahadasha & Antardasha",
  "Important Yogas & Doshas (Manglik, Kaal Sarp & more)",
  "Remedies & Practical Guidance",
  "Key Strengths, Opportunities & Lucky Factors",
];

// Premium / Master main report: the full 20 core sections.
const PREMIUM_SECTIONS = [
  "Rashi (Moon Sign) & Personality",
  "Lagna (Ascendant) & Physical Traits",
  "Sun Sign & Core Identity",
  "Nakshatra (Birth Star) Analysis",
  "Planetary Positions & Strengths",
  "Career & Professional Life",
  "Wealth & Financial Prospects",
  "Marriage & Love Life",
  "Family & Relationships",
  "Health & Physical Wellbeing",
  "Education & Intellectual Growth",
  "Current Mahadasha Analysis",
  "Upcoming Dasha Predictions (Next 5 Years)",
  "Manglik Dosha Analysis",
  "Kaal Sarp & Other Yoga Analysis",
  "Favorable & Unfavorable Periods",
  "Remedies & Spiritual Guidance",
  "Lucky Factors (Numbers, Colors, Gems, Days)",
  "Monthly Predictions for 2026-2027",
  "Life Purpose & Spiritual Path",
];

export async function generateFullReport({
  name,
  gender,
  dateOfBirth,
  timeOfBirth,
  placeOfBirth,
  chartData,
  personalQuestion,
  // New tier-aware params:
  tier,
  guidanceMonths,
  // Legacy param (still supported): maps to Essential-with-guidance semantics.
  includeBump,
}) {
  if (!name || !chartData) {
    throw new Error("Missing required fields for report generation");
  }

  // Resolve effective tier. If not provided, preserve historical behavior
  // (full 20-section report) so any older caller doesn't regress.
  const effectiveTier = tier === "essential" ? "essential" : "premium";
  const includeGuidance =
    typeof guidanceMonths === "number" ? guidanceMonths > 0 : !!includeBump;

  const coreSections =
    effectiveTier === "essential" ? ESSENTIAL_SECTIONS : PREMIUM_SECTIONS;

  const planetaryTable = Object.entries(chartData.planets)
    .map(
      ([planet, data]) =>
        `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | Navamsa D9: ${data.navamsa} | ${data.dignity}`
    )
    .join("\n");

  // Lucky factors (pre-computed from ascendant lord) — must be used exactly.
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

  const safeQuestion = sanitizeForPrompt(personalQuestion, 300);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  // Build the numbered section list for the prompt.
  const numberedCore = coreSections.map((t, i) => `${i + 1}. ${t}`).join("\n");
  let nextNum = coreSections.length + 1;
  let extraSections = "";
  if (safeQuestion) {
    extraSections += `\n${nextNum}. Personal Concern: Answer "${safeQuestion}" using relevant houses/planets/transits. Be specific about timing (anchor to the computed dasha above).`;
    nextNum += 1;
  }
  if (includeGuidance) {
    extraSections += `\n${nextNum}. 12-Month Personal Guidance Pack — Make it substantial (500-700 words). Include ALL of: (a) a brief month-by-month forecast for the next 12 months covering career, money, love, and health each month; (b) which months are BEST for action and which are CAUTION months; (c) key timing windows; (d) a simple monthly action plan; (e) safe personal remedies (journaling, meditation, discipline, charity, mantra); (f) a final 12-month yearly-theme summary. Anchor timing to the computed dasha/antardasha above.`;
  }

  const wordGuide = effectiveTier === "essential" ? "220-320 words" : "250-350 words";

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
CRITICAL TIMELINE INSTRUCTION: The Mahadasha/Antardasha period stated above is a HARD FACT computed from the Moon's exact birth degree — treat it as ground truth. You MUST use this exact running period and its dates in every timeline-based prediction. You are strictly forbidden from calculating, inferring, or guessing the current dasha from the person's age or from the dasha sequence years.

NAVAMSA (D9) INSTRUCTION: Each planet's and the Ascendant's Navamsa (D9) sign is listed above as a HARD FACT. Whenever you reference a navamsa, you MUST use these exact D9 signs and are strictly forbidden from computing or guessing any navamsa yourself.

MANGLIK (MANGAL DOSHA) STATUS (computed — USE EXACTLY): ${chartData.manglik?.summary || "Not available"}
MANGLIK INSTRUCTION: Wherever you discuss Manglik status, you MUST use the verdict and reasoning stated above. Do NOT decide it yourself — Manglik houses are only 1, 2, 4, 7, 8, and 12 (never the 9th).

YOGAS (computed — USE EXACTLY): ${chartData.yogas?.summary || "Not available"}
YOGA INSTRUCTION: Wherever you discuss yogas (including Kaal Sarp), you MUST use the exact verdict and list above. If Kaal Sarp is ABSENT, clearly state it is absent. Do NOT invent or contradict any yoga.

LUCKY FACTORS (computed from Ascendant Lord — USE EXACTLY): Primary Gem = ${luckyFactors.gem}, Primary Color = ${luckyFactors.color}, Primary Numbers = ${luckyFactors.lucky}, Primary Day = ${luckyFactors.day}. Wherever you list lucky factors, these PRIMARY values must appear first and must not be contradicted.

Generate a report with the sections below. Each core section ${wordGuide}, referencing specific planets/houses/degrees.

Format JSON:
{
  "summary": "2-3 sentences with specific positions",
  "sections": [{ "title": "...", "content": "..." }]
}

Sections:
${numberedCore}${extraSections}

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

  // Quality gate: enough sections, and the paid guidance section must exist if bought.
  const minSections = effectiveTier === "essential" ? 8 : 15;
  const hasGuidanceSection =
    Array.isArray(reportData.sections) &&
    reportData.sections.some((s) => /guidance pack|12-month/i.test(s.title || ""));
  if (
    !reportData.sections ||
    reportData.sections.length < minSections ||
    (includeGuidance && !hasGuidanceSection)
  ) {
    throw new Error("Incomplete report. Please try again.");
  }

  return {
    summary: reportData.summary,
    sections: reportData.sections,
  };
}
