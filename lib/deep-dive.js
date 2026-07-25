import { generateWithRetry } from "./gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sanitizeForPrompt } from "./sanitize.js";
import { MASTER_DEEP_DIVE_SECTIONS, MASTER_ROADMAP_MONTHS } from "./plans.js";

/**
 * Master deep-dive: a concern-specific specialized report generated as a
 * SEPARATE Gemini call from the main report (so neither request risks the
 * Vercel 60s timeout). The user's personal question determines the focus,
 * which turns the 7 deep-dive sections into a Career / Marriage / Wealth /
 * Relationship / Health / General deep-dive automatically.
 */

// Keyword → focus classification. First matching focus wins (order matters:
// marriage before relationship, since "marriage" implies the spouse theme).
const FOCUS_RULES = [
  { focus: "career", words: ["job", "career", "work", "business", "promotion", "salary", "profession", "employment", "interview", "startup", "office", "boss", "naukri"] },
  { focus: "marriage", words: ["marriage", "married", "spouse", "wedding", "husband", "wife", "shaadi", "vivah", "divorce", "matrimony"] },
  { focus: "wealth", words: ["money", "wealth", "finance", "financial", "rich", "debt", "loan", "property", "investment", "income", "savings", "dhan", "paisa"] },
  { focus: "relationship", words: ["love", "relationship", "partner", "girlfriend", "boyfriend", "breakup", "crush", "romance", "prem", "affair", "dating"] },
  { focus: "health", words: ["health", "disease", "illness", "sick", "medical", "surgery", "mental", "anxiety", "depression", "recovery", "fitness"] },
];

export const FOCUS_LABELS = {
  career: "Career",
  marriage: "Marriage",
  wealth: "Wealth",
  relationship: "Relationship",
  health: "Health",
  general: "Life Path",
};

/**
 * Classify a personal question into a deep-dive focus theme.
 * @param {string} personalQuestion
 * @returns {"career"|"marriage"|"wealth"|"relationship"|"health"|"general"}
 */
export function classifyFocus(personalQuestion) {
  const q = (personalQuestion || "").toLowerCase();
  if (!q.trim()) return "general";
  for (const rule of FOCUS_RULES) {
    if (rule.words.some((w) => q.includes(w))) return rule.focus;
  }
  return "general";
}

// The 7 deep-dive section titles per focus + a fixed 24-month roadmap section.
const FOCUS_SECTIONS = {
  career: [
    "Why Your Career Feels the Way It Does Right Now",
    "Your Strongest Professional Traits & Natural Talents",
    "Best Career Directions From Your Chart",
    "Job-Change, Interview & Offer Timing",
    "Promotion & Salary-Growth Periods",
    "Foreign / Relocation & Expansion Potential",
    "Career Obstacles, Caution Periods & Remedies",
  ],
  marriage: [
    "Your Marriage Outlook & the 7th House Story",
    "The Nature & Qualities of Your Life Partner",
    "Marriage Timing Windows",
    "Manglik / Dosha Impact on Married Life & Its Balance",
    "Harmony, Friction Points & How to Navigate Them",
    "Family, In-Laws & Domestic Life",
    "Marriage Cautions & Strengthening Remedies",
  ],
  wealth: [
    "Your Wealth Blueprint & the 2nd / 11th House Story",
    "Primary Sources of Income & Gains",
    "Wealth-Building & High-Earning Periods",
    "Property, Assets & Long-Term Investments",
    "Debt, Expenses & Financial Caution Periods",
    "Business vs Job — What Your Chart Favours",
    "Wealth Obstacles & Prosperity Remedies",
  ],
  relationship: [
    "Your Emotional & Romantic Nature",
    "What You Truly Need in a Partner",
    "Relationship Timing & Meaningful Connection Windows",
    "Patterns, Past Hurts & What Keeps Repeating",
    "Compatibility Themes From Your Chart",
    "Communication, Trust & Deepening the Bond",
    "Relationship Cautions & Harmony Remedies",
  ],
  health: [
    "Your Constitution & Overall Health Blueprint",
    "Body Areas & Systems to Watch",
    "Sensitive Health Periods & Timing",
    "Mental & Emotional Wellbeing",
    "Diet, Routine & Lifestyle Aligned to Your Chart",
    "Recovery, Vitality & Strengthening Periods",
    "Health Cautions & Protective Remedies",
  ],
  general: [
    "The Central Theme of This Life Chapter",
    "Your Core Strengths & Hidden Talents",
    "Turning-Point Timing Over the Coming Period",
    "Your Biggest Growth Opportunities",
    "Recurring Challenges & How to Move Past Them",
    "Relationships, Work & Life Balance",
    "Caution Periods & Personalized Remedies",
  ],
};

/**
 * Generate the Master deep-dive: 7 focus-specific sections + a 24-month roadmap.
 * A single Gemini call, separate from the main report.
 *
 * @returns {Promise<{ focus: string, sections: Array<{title,content}> }>}
 */
export async function generateDeepDive({ name, chartData, personalQuestion, focus }) {
  if (!name || !chartData) throw new Error("Missing required fields for deep-dive generation");

  const resolvedFocus = focus || classifyFocus(personalQuestion);
  const label = FOCUS_LABELS[resolvedFocus] || FOCUS_LABELS.general;
  const titles = FOCUS_SECTIONS[resolvedFocus] || FOCUS_SECTIONS.general;

  const planetaryTable = Object.entries(chartData.planets || {})
    .map(
      ([planet, data]) =>
        `${planet}: ${data.sign} (${data.degree}) | House ${data.house} | Navamsa D9: ${data.navamsa} | ${data.dignity}`
    )
    .join("\n");

  const safeQuestion = sanitizeForPrompt(personalQuestion, 300);

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const numbered = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");
  const roadmapTitle = `${MASTER_ROADMAP_MONTHS}-Month ${label} Roadmap`;

  const prompt = `You are an expert Vedic astrologer (Jyotishi) writing the SPECIALIZED ${label.toUpperCase()} DEEP-DIVE section of a premium "Master" report for ${name}. Interpret these EXACT calculated positions (Swiss Ephemeris, Lahiri Ayanamsa). Do NOT recalculate.

BIRTH CHART:
Ascendant: ${chartData.ascendant?.sign} at ${chartData.ascendant?.degree} | Navamsa D9: ${chartData.ascendant?.navamsa}
Moon Nakshatra: ${chartData.nakshatra?.name} (Pada ${chartData.nakshatra?.pada}), Lord: ${chartData.nakshatra?.ruler}
Rashi: ${chartData.rashi}

PLANETS:
${planetaryTable}

CURRENT DASHA (USE EXACTLY — do NOT guess):
${chartData.dashaTimeline?.summary || "Not available"}

MANGLIK STATUS (computed — USE EXACTLY): ${chartData.manglik?.summary || "Not available"}
YOGAS (computed — USE EXACTLY): ${chartData.yogas?.summary || "Not available"}

The customer's main concern: ${safeQuestion ? `"${safeQuestion}"` : `(general ${label.toLowerCase()} focus)`}

Write a focused, deeply personalized ${label} deep-dive. Produce EXACTLY ${MASTER_DEEP_DIVE_SECTIONS} deep-dive sections followed by 1 roadmap section (${MASTER_DEEP_DIVE_SECTIONS + 1} total).

Deep-dive sections (each 250-350 words, referencing specific planets/houses/degrees):
${numbered}

Then the final roadmap section:
${MASTER_DEEP_DIVE_SECTIONS + 1}. ${roadmapTitle} — a month-by-month / quarter-by-quarter ${label.toLowerCase()} action plan spanning the next ${MASTER_ROADMAP_MONTHS} months. Anchor every timing statement to the computed dasha/antardasha above. Clearly mark BEST periods for action and CAUTION periods. 500-700 words.

RULES:
- Anchor ALL timing to the computed dasha above — never guess the current period.
- Use ${name}'s name. Mix Hindi/Sanskrit terms with English.
- NEVER use fear words like "disaster", "danger", "tragedy" — use "challenging period / careful decisions".
- Be specific and practical, not generic.

Return ONLY valid JSON in EXACTLY this shape:
{
  "sections": [{ "title": "...", "content": "..." }]
}`;

  // Try up to 2 times — flash-lite can truncate long outputs.
  const MAX_ATTEMPTS = 2;
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await generateWithRetry(model, prompt);
      const responseText = result.response.text();

      let parsed;
      try {
        const match = responseText.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("No JSON found");
        parsed = JSON.parse(match[0]);
      } catch (e) {
        console.error(`Deep-dive parse error (attempt ${attempt}):`, e.message);
        lastError = new Error("Failed to generate deep-dive. Please try again.");
        continue;
      }

      const sections = Array.isArray(parsed?.sections) ? parsed.sections : [];
      // Expect 7 deep-dive + 1 roadmap = 8. Accept >= 6 to tolerate minor variance.
      if (sections.length < 6) {
        console.warn(`Deep-dive quality gate failed (attempt ${attempt}): got ${sections.length} sections, need 6+`);
        lastError = new Error("Incomplete deep-dive generated.");
        continue;
      }

      return { focus: resolvedFocus, sections };
    } catch (err) {
      lastError = err;
      console.error(`Deep-dive attempt ${attempt} failed:`, err.message);
    }
  }

  throw lastError || new Error("Failed to generate deep-dive after retries.");
}
