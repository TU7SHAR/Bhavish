import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { generateWithRetry } from "../../../../lib/gemini-retry.js";

// Admin: AI-generate a broadcast email (subject + body) from a short goal/topic.
// Uses the same generateWithRetry wrapper (so it survives Gemini 503s) and the
// same 3.1-flash-lite primary voice as the rest of the product.
//
// POST /api/admin/broadcast-generate
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { goal: "remind unpaid leads their free preview is waiting", audience?: "unpaid leads" }
// Returns: { subject, body }  — plain text, admin edits before sending.
export const maxDuration = 30;

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { goal, audience } = body || {};
  if (!goal || !goal.trim()) {
    return NextResponse.json({ error: "A goal/topic is required." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `You are the founder of BhavishAI (bhavishai.in), an AI-powered Vedic astrology service that sells personalized Janam Kundli reports from Rs 299. Write ONE marketing/broadcast email.

Goal of this email: "${goal.trim()}"
${audience ? `Audience: ${audience}` : ""}

STRICT RULES:
- Warm, personal, trustworthy tone — like a knowledgeable astrologer, not a pushy marketer.
- Indian audience; simple clear English (a little Hindi/Sanskrit word is fine if natural).
- Keep it SHORT: 3-5 short paragraphs max.
- ONE clear call to action. The main link is https://www.bhavishai.in/get-report
- Never guarantee outcomes or use fear-mongering. Frame astrology as guidance/tendencies.
- Do NOT include a greeting line like "Hi {name}" — the system adds the greeting.
- Do NOT include an unsubscribe line — the system adds it.
- Plain text only (no HTML, no markdown). Use blank lines between paragraphs.

Return ONLY valid JSON, no markdown/code fences:
{"subject": "compelling subject line under 60 characters", "body": "the email body as plain text with \\n between paragraphs"}`;

    const result = await generateWithRetry(model, prompt);
    const text = result.response.text();

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "AI did not return valid JSON. Try again." }, { status: 500 });
    }
    const parsed = JSON.parse(match[0]);
    if (!parsed.subject || !parsed.body) {
      return NextResponse.json({ error: "AI response missing subject or body. Try again." }, { status: 500 });
    }

    return NextResponse.json({ subject: parsed.subject.trim(), body: parsed.body.trim() });
  } catch (error) {
    console.error("broadcast-generate error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
