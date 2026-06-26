import { generateWithRetry } from "./gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// The 10-email sequence: psychology + send schedule (hours after lead created).
// EMAIL_PLAN order MUST stay aligned with EMAIL_SCHEDULE_HOURS in the cron
// (/api/cron/send-nurture-emails) so draft[i] is sent at schedule[i].
export const EMAIL_PLAN = [
  { num: 1, psychology: "unfinished_task", guide: "Warm reminder their personalized report is waiting. Reference it was built from their exact birth details. Soft CTA. No fear/urgency." },
  { num: 2, psychology: "curiosity_gap", guide: "Create curiosity. Tease ONE insight from their chart without revealing the answer. Mention the full report has combinations not shown in the preview." },
  { num: 3, psychology: "authority", guide: "Educational. Explain briefly how Swiss Ephemeris + exact birth coordinates make this accurate Vedic astrology. Build credibility." },
  { num: 4, psychology: "personal_identity", guide: "Personal. Reference their specific concern/question directly and warmly. Remind them the full report has the detailed analysis." },
  { num: 5, psychology: "future_self", guide: "Future-self framing. Imagine looking back 6 months from now wishing they'd checked their planetary timeline. Inspirational, not fearful." },
  { num: 6, psychology: "social_proof", guide: "Social proof. Many personalized reports generated, average 20 pages of structured analysis. Most users unlock within minutes of the preview." },
  { num: 7, psychology: "loss_aversion", guide: "Their chart highlights a transition window where careful decisions may matter more than usual. NEVER say disaster/danger. The full report maps these periods precisely." },
  { num: 8, psychology: "hope", guide: "Hopeful. Every chart has periods of major opportunity. The question is WHEN, not IF. The full report has the exact timing of their strongest periods." },
  { num: 9, psychology: "commitment", guide: "Very short. One gentle question about their main concern. Report is still available whenever they're ready." },
  { num: 10, psychology: "discount", guide: "Final email. Offer 15% off with code DESTINY15, one-time, expiring in 24 hours. Brief, clear CTA." },
];

// Makes ONE Gemini call and returns a normalized array of 10 drafts:
// [{ num, subject, body, psychology }]. Throws on hard failure.
export async function generateEmailDrafts({
  name,
  summary,
  sections,
  dateOfBirth,
  placeOfBirth,
  personalQuestion,
}) {
  const sectionSnippet =
    Array.isArray(sections) && sections[0]?.content
      ? sections[0].content.substring(0, 400)
      : "";
  const chartContext = `${summary || ""}\n${sectionSnippet}`.trim().substring(0, 700);
  const firstName = (name || "there").split(" ")[0];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const planText = EMAIL_PLAN.map(
    (e) => `Email ${e.num} (${e.psychology}): ${e.guide}`
  ).join("\n");

  const prompt = `You are writing a 10-email nurture sequence for BhavishAI, a Vedic astrology report service.
The recipient generated a free chart preview but has NOT yet unlocked their full ₹299 report.

RECIPIENT:
- Name: ${name} (use first name "${firstName}")
- Date of birth: ${dateOfBirth || "n/a"} | Place: ${placeOfBirth || "n/a"}
- Their main concern/question: ${personalQuestion ? `"${personalQuestion}"` : "(none provided — keep it general about career/life path)"}

THEIR CHART PREVIEW (use to personalize, stay consistent — do NOT contradict this):
"""
${chartContext || "(preview text unavailable — keep references general but warm)"}
"""

Write all 10 emails below. Each email maps to a psychology and stage:
${planText}

STRICT RULES:
- Each email body: max 100 words, conversational, warm, NOT salesy.
- Use the first name "${firstName}". Do NOT add greetings like "Dear" or sign-offs like "Best regards" — start directly with the message.
- NEVER claim "disaster", "danger", "tragedy" or fake fear. Use "challenging period / careful decisions" framing only.
- Stay consistent with the chart preview above — never invent contradicting predictions.
- End each body with a natural nudge toward unlocking the report at bhavishai.in.
- Body must be plain text (no HTML tags).
- Subject lines: short, curiosity-driven, lowercase-friendly, no emojis.

Return ONLY valid JSON, no markdown, in EXACTLY this shape (10 items, in order 1..10):
{
  "emails": [
    { "num": 1, "subject": "...", "body": "..." },
    { "num": 2, "subject": "...", "body": "..." }
  ]
}`;

  const result = await generateWithRetry(model, prompt);
  const responseText = result.response.text();

  const match = responseText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
  const parsed = JSON.parse(match[0]);

  let emails = Array.isArray(parsed?.emails) ? parsed.emails : [];
  emails = emails
    .filter((e) => e && (e.subject || e.body))
    .slice(0, 10)
    .map((e, i) => ({
      num: e.num || i + 1,
      subject: (e.subject || "Your BhavishAI report").toString().trim(),
      body: (e.body || "").toString().trim(),
      psychology: EMAIL_PLAN[i]?.psychology || "unfinished_task",
    }));

  if (emails.length === 0) throw new Error("No email drafts generated");
  return emails;
}
