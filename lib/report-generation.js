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
  // maxOutputTokens raised so a batch of ~10 sections (≈4k words) never gets
  // truncated. flash-lite's default ceiling was silently cutting the old
  // single 22-section call down to ~10 sections.
  const model = genAI.getGenerativeModel({
    model: "gemini-3.1-flash-lite",
    generationConfig: { maxOutputTokens: 8192, temperature: 0.8 },
  });

  const wordGuide = effectiveTier === "essential" ? "220-320 words" : "250-350 words";

  // Shared chart context — every batch prompt is built on top of this so the
  // AI always has the full computed chart and the same hard-fact instructions.
  const chartContext = `You are an expert Vedic astrologer (Jyotishi). Interpret these EXACT calculated positions (Swiss Ephemeris, Lahiri Ayanamsa). Do NOT recalculate.

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

LUCKY FACTORS (computed from Ascendant Lord — USE EXACTLY): Primary Gem = ${luckyFactors.gem}, Primary Color = ${luckyFactors.color}, Primary Numbers = ${luckyFactors.lucky}, Primary Day = ${luckyFactors.day}. Wherever you list lucky factors, these PRIMARY values must appear first and must not be contradicted.`;

  // Extra (non-core) section instructions, generated alongside the last batch.
  const questionLine = safeQuestion
    ? `Personal Concern: Answer "${safeQuestion}" using relevant houses/planets/transits. Be specific about timing (anchor to the computed dasha above).`
    : null;
  const guidanceLine = includeGuidance
    ? `12-Month Personal Guidance Pack — Make it substantial (500-700 words). Include ALL of: (a) a brief month-by-month forecast for the next 12 months covering career, money, love, and health each month; (b) which months are BEST for action and which are CAUTION months; (c) key timing windows; (d) a simple monthly action plan; (e) safe personal remedies (journaling, meditation, discipline, charity, mantra); (f) a final 12-month yearly-theme summary. Anchor timing to the computed dasha/antardasha above.`
    : null;

  // Generate one batch of sections. Retries twice; returns { summary?, sections }.
  const generateBatch = async (sectionTitlesOrLines, { wantSummary }) => {
    const numbered = sectionTitlesOrLines.map((t, i) => `${i + 1}. ${t}`).join("\n");
    const summaryField = wantSummary ? `  "summary": "2-3 sentences with specific positions",\n` : "";
    const prompt = `${chartContext}

Generate the sections listed below. Each core section ${wordGuide}, referencing specific planets/houses/degrees. Generate EVERY section listed — do not skip or merge any.

Format JSON:
{
${summaryField}  "sections": [{ "title": "...", "content": "..." }]
}

Sections:
${numbered}

Use ${name}'s name. Mix Hindi/Sanskrit with English. Return ONLY valid JSON.`;

    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const result = await generateWithRetry(model, prompt);
        const text = result.response.text();
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) { lastErr = new Error("No JSON found"); continue; }
        const parsed = JSON.parse(match[0]);
        if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
          lastErr = new Error("No sections in response");
          continue;
        }
        return parsed;
      } catch (e) {
        console.error(`Report batch parse/gen error (attempt ${attempt}):`, e.message);
        lastErr = new Error("Failed to generate full report. Please try again.");
      }
    }
    throw lastErr || new Error("Failed to generate report batch.");
  };

  let summary;
  let sections;

  if (effectiveTier === "essential") {
    // Essential: a single call comfortably fits 10 core + question + guidance.
    const lines = [...coreSections];
    if (questionLine) lines.push(questionLine);
    if (guidanceLine) lines.push(guidanceLine);
    const res = await generateBatch(lines, { wantSummary: true });
    summary = res.summary;
    sections = res.sections;
  } else {
    // Premium / Master: split the 20 core sections into TWO calls so flash-lite
    // never truncates. Batch 1 = first 10 core (+ summary); Batch 2 = last 10
    // core + personal question + guidance. Sequential to respect rate limits.
    const half = Math.ceil(coreSections.length / 2);
    const firstHalf = coreSections.slice(0, half);
    const secondHalf = coreSections.slice(half);
    const secondLines = [...secondHalf];
    if (questionLine) secondLines.push(questionLine);
    if (guidanceLine) secondLines.push(guidanceLine);

    const res1 = await generateBatch(firstHalf, { wantSummary: true });
    const res2 = await generateBatch(secondLines, { wantSummary: false });
    summary = res1.summary;
    sections = [...(res1.sections || []), ...(res2.sections || [])];
  }

  // Quality gate: full section count, and the paid guidance section if bought.
  // Essential ≈ 11-12; Premium/Master ≈ 22. Require most of them so a truncated
  // report is never delivered to a paying customer.
  const minSections = effectiveTier === "essential" ? 8 : 18;
  const hasGuidanceSection =
    Array.isArray(sections) &&
    sections.some((s) => /guidance pack|12-month/i.test(s.title || ""));
  if (
    !sections ||
    sections.length < minSections ||
    (includeGuidance && !hasGuidanceSection)
  ) {
    console.warn(`Full-report quality gate failed: ${sections?.length || 0} sections (need ${minSections}), guidance=${hasGuidanceSection}`);
    throw new Error("Incomplete report. Please try again.");
  }

  return { summary, sections };
}
