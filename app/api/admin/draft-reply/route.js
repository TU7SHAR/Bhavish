import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin endpoint: use Gemini AI to draft an email reply.
// POST /api/admin/draft-reply
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { customerMessage, type: "customer_response" | "lead_nurture" | "other", customerName? }
//
// Returns: { subject, body }
// Does NOT send anything — just generates the draft for review.
export const maxDuration = 30;

const SYSTEM_PROMPTS = {
  customer_response: `You are Tushar, founder of BhavishAI — a Vedic astrology report service (AI-generated personalized birth chart reports for ₹299).
You're replying to a PAID customer who has a question or concern.

Rules:
- Be warm, personal, and helpful
- Keep it concise (3-5 short paragraphs max)
- Sign off as "Tushar" (no last name)
- If they're asking about their report: acknowledge their concern, provide a helpful answer
- If they're asking for astrology advice beyond the report: gently explain the report covers this, suggest they re-read the relevant section
- If it's a technical issue (didn't receive report, payment issue): be empathetic, assure them you'll resolve it
- If they haven't received their report: tell them to check spam, and that they can always access it at https://www.bhavishai.in/get-report
- Always include this link naturally: https://www.bhavishai.in/get-report (for accessing/viewing their report)
- If upselling is appropriate (they seem engaged), mention the 12-Month Guidance Pack (₹149 add-on) or that they can generate reports for family/friends
- Tone: friendly founder, not corporate support bot
- Language: English (mix in simple Hindi words if their message was in Hindi/Hinglish)
- Do NOT use emojis in the body (only ok in subject if appropriate)
- Generate a short, natural subject line (like "Re: your report" or appropriate reply subject)`,

  lead_nurture: `You are Tushar, founder of BhavishAI — a Vedic astrology report service (AI-generated personalized birth chart reports for ₹299).
You're replying to an UNPAID lead who asked a personal question during sign-up but hasn't bought the report yet.

Your goal: Create curiosity and nudge them toward purchasing, WITHOUT giving away the full answer.

Rules:
- Acknowledge their question warmly
- Give a TEASER answer — enough to show you understand their concern, but not the full prediction
- Create curiosity: hint that their birth chart shows interesting patterns related to their question
- End with a clear CTA: tell them their full personalized report covers this in detail with timing, remedies, and specific predictions
- ALWAYS include this exact link naturally in the body: https://www.bhavishai.in/get-report — tell them to complete their report there
- Mention the price (₹299) — it's affordable for a full 20-page personalized Vedic astrology report
- Keep it SHORT (3-4 paragraphs max)
- Tone: knowledgeable astrologer who genuinely wants to help, not pushy salesman
- Do NOT make up specific predictions — keep it general but intriguing
- Sign off as "Tushar"
- Language: English (use Hindi/Hinglish if their message was in Hindi)
- Generate a subject line that creates curiosity (e.g. "About your question on marriage timing...")
- Do NOT use emojis in body`,

  other: `You are Tushar, founder of BhavishAI — a Vedic astrology report service (AI-generated personalized 20-page birth chart reports for ₹299).
You're replying to a general email inquiry.

Rules:
- Be professional but warm
- Keep it concise
- Answer their question directly
- Always include this link: https://www.bhavishai.in/get-report — for generating/accessing reports
- If relevant, mention BhavishAI services (₹299 full report, 12-Month Guidance ₹149 add-on, Founder membership for unlimited reports)
- Sign off as "Tushar"
- Generate an appropriate subject line
- Do NOT use emojis in body`,
};

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { customerMessage, type, customerName } = await request.json();

    if (!customerMessage || !customerMessage.trim()) {
      return NextResponse.json({ error: "Missing customer message" }, { status: 400 });
    }

    const validTypes = ["customer_response", "lead_nurture", "other"];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `Invalid type. Must be one of: ${validTypes.join(", ")}` }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const systemPrompt = SYSTEM_PROMPTS[type];
    const userPrompt = `${customerName ? `Customer name: ${customerName}\n` : ""}Their message:\n"${customerMessage.trim()}"

Generate a reply. Return ONLY valid JSON (no markdown, no code fences):
{"subject": "your subject line here", "body": "your full email body here (use \\n for line breaks)"}`;

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    });

    const text = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI did not return valid JSON. Raw: " + text.substring(0, 200) }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.subject || !parsed.body) {
      return NextResponse.json({ error: "AI response missing subject or body" }, { status: 500 });
    }

    return NextResponse.json({
      subject: parsed.subject,
      body: parsed.body,
    });
  } catch (error) {
    console.error("draft-reply error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
