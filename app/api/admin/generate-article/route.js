import { generateWithRetry } from "../../../../lib/gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Admin: generate a new SEO blog article with Gemini and store it in Supabase.
// POST /api/admin/generate-article
// Header: Authorization: Bearer <ADMIN_SECRET or CRON_SECRET>
// Body: { topic: "What is Sade Sati?", keyword?: "sade sati" }
export const maxDuration = 60;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .substring(0, 70);
}

export async function POST(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { topic, keyword } = await request.json();
    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Missing topic" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `You are an SEO content writer for BhavishAI, an AI-powered Vedic astrology platform (bhavishai.in) that sells personalized 20-page Janam Kundli reports for Rs 299.

Write a high-quality, accurate, beginner-friendly blog article about this topic:
"${topic}"
${keyword ? `Primary SEO keyword to target: "${keyword}"` : ""}

STRICT RULES:
- Be factually accurate about Vedic astrology (Jyotish). Do not invent fake claims.
- Frame predictions as tendencies, never guarantees. Never use fear-mongering.
- Write in clear, simple English for an Indian audience.
- 500-800 words.
- End with a short paragraph that naturally invites the reader to get their own personalized report from BhavishAI.
- Body must be valid HTML using only <p>, <h2>, <ul>, <li>, <strong>, <em> tags. No <h1>, no markdown, no inline styles.

Return ONLY valid JSON in EXACTLY this shape (no markdown fences):
{
  "title": "An SEO-friendly article title (under 70 chars)",
  "description": "A meta description, 140-160 chars, compelling and keyword-rich",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "readMinutes": 5,
  "content": "<p>...</p><h2>...</h2><p>...</p>..."
}`;

    const result = await generateWithRetry(model, prompt);
    const text = result.response.text();

    let parsed;
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      parsed = JSON.parse(match[0]);
    } catch (e) {
      console.error("Article parse error:", e.message);
      return NextResponse.json({ error: "Failed to parse generated article" }, { status: 500 });
    }

    if (!parsed.title || !parsed.content) {
      return NextResponse.json({ error: "Generated article missing title or content" }, { status: 500 });
    }

    const slug = slugify(parsed.title);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { error: insertError } = await supabase.from("blog_posts").upsert(
      {
        slug,
        title: parsed.title.substring(0, 200),
        description: (parsed.description || "").substring(0, 300),
        content: parsed.content,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        read_minutes: parsed.readMinutes || 5,
        published: true,
      },
      { onConflict: "slug" }
    );

    if (insertError) {
      console.error("Failed to store article:", insertError);
      return NextResponse.json(
        { error: "Failed to save article. Did you run the blog_posts SQL migration?", details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      slug,
      title: parsed.title,
      url: `/blog/${slug}`,
    });
  } catch (error) {
    console.error("generate-article error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
