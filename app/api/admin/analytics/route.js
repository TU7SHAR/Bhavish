import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Admin analytics API — computes insights from all reports data.
// Uses Gemini AI to categorize personal questions (cached in DB).
// GET /api/admin/analytics
// Header: Authorization: Bearer <ADMIN_SECRET>
export const maxDuration = 60;

// ===== AI CATEGORIZATION =====
async function categorizeWithAI(questions) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const prompt = `You are categorizing personal questions asked by users of a Vedic astrology report service (Indian audience, mix of Hindi/English/Hinglish).

Categorize EACH question into exactly ONE of these categories:
- Career & Job
- Marriage
- Love & Relationships
- Money & Finance
- Business & Startup
- Foreign & Travel
- Health
- Education & Exams
- Children & Family
- Property & Home
- Timing & Predictions
- Remedies & Spirituality
- General / Other

Here are the questions (numbered):
${questions.map((q, i) => `${i + 1}. "${q}"`).join("\n")}

Return ONLY valid JSON array, no markdown:
[{"index": 1, "category": "Career & Job"}, {"index": 2, "category": "Marriage"}, ...]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("No JSON array in AI response");
  return JSON.parse(match[0]);
}

// ===== CACHE LOGIC =====
async function getCachedCategories(supabase, cacheKey, currentCount, questions) {
  // Try to read cache
  try {
    const { data: cached } = await supabase
      .from("analytics_cache")
      .select("data, report_count")
      .eq("key", cacheKey)
      .maybeSingle();

    // Cache hit — report count matches (no new data since last categorization)
    if (cached && cached.report_count === currentCount && cached.data) {
      return cached.data;
    }
  } catch (e) {
    // Table might not exist yet — proceed without cache
    console.warn("analytics_cache read failed (table may not exist):", e.message);
  }

  // Cache miss or stale — run AI categorization
  if (questions.length === 0) return [];

  const aiResults = await categorizeWithAI(questions);

  // Map results back to questions
  const categorized = questions.map((q, i) => {
    const aiResult = aiResults.find((r) => r.index === i + 1);
    return { question: q, category: aiResult?.category || "General / Other" };
  });

  // Save to cache
  try {
    await supabase.from("analytics_cache").upsert({
      key: cacheKey,
      data: categorized,
      report_count: currentCount,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
  } catch (e) {
    console.warn("analytics_cache write failed:", e.message);
  }

  return categorized;
}

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: reports } = await supabase
      .from("reports")
      .select("created_at, payment_status, gender, device_type, city, personal_question, attribution, paid_at, is_founder_member, has_12_month_guidance, sections")
      .order("created_at", { ascending: false });

    const all = reports || [];
    const paid = all.filter((r) => r.payment_status === "paid");
    const unpaid = all.filter((r) => r.payment_status === "unpaid");

    // IST offset for hour calculations
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;

    // ===== PEAK HOURS =====
    const hourlyLeads = Array(24).fill(0);
    const hourlyPaid = Array(24).fill(0);
    all.forEach((r) => {
      const istHour = new Date(new Date(r.created_at).getTime() + IST_OFFSET).getUTCHours();
      hourlyLeads[istHour]++;
    });
    paid.forEach((r) => {
      const ts = r.paid_at || r.created_at;
      const istHour = new Date(new Date(ts).getTime() + IST_OFFSET).getUTCHours();
      hourlyPaid[istHour]++;
    });

    // Day of week
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dailyLeads = Array(7).fill(0);
    const dailyPaid = Array(7).fill(0);
    all.forEach((r) => {
      const day = new Date(new Date(r.created_at).getTime() + IST_OFFSET).getUTCDay();
      dailyLeads[day]++;
    });
    paid.forEach((r) => {
      const ts = r.paid_at || r.created_at;
      const day = new Date(new Date(ts).getTime() + IST_OFFSET).getUTCDay();
      dailyPaid[day]++;
    });

    // ===== DEMOGRAPHICS =====
    const genderStats = { male: { leads: 0, paid: 0 }, female: { leads: 0, paid: 0 }, other: { leads: 0, paid: 0 } };
    all.forEach((r) => {
      const g = (r.gender || "other").toLowerCase();
      const key = g === "male" ? "male" : g === "female" ? "female" : "other";
      genderStats[key].leads++;
      if (r.payment_status === "paid") genderStats[key].paid++;
    });

    const deviceStats = { mobile: { leads: 0, paid: 0 }, desktop: { leads: 0, paid: 0 } };
    all.forEach((r) => {
      const d = r.device_type === "mobile" ? "mobile" : r.device_type === "desktop" ? "desktop" : null;
      if (d) {
        deviceStats[d].leads++;
        if (r.payment_status === "paid") deviceStats[d].paid++;
      }
    });

    // ===== GEOGRAPHY =====
    const cityStats = {};
    all.forEach((r) => {
      if (!r.city) return;
      if (!cityStats[r.city]) cityStats[r.city] = { leads: 0, paid: 0 };
      cityStats[r.city].leads++;
      if (r.payment_status === "paid") cityStats[r.city].paid++;
    });
    const topCities = Object.entries(cityStats)
      .map(([city, s]) => ({ city, ...s, convRate: s.leads > 0 ? ((s.paid / s.leads) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 15);

    // ===== QUESTIONS (AI CATEGORIZED) =====
    // Extract personal question from:
    // 1. personal_question column (new leads after PR #68)
    // 2. Section 21 title containing "Personal Concern:" (older leads)
    function getQuestion(r) {
      if (r.personal_question && r.personal_question.trim()) return r.personal_question.trim();
      // Fallback: check sections for a "Personal Concern" section (section 21)
      if (Array.isArray(r.sections)) {
        const personalSection = r.sections.find((s) =>
          s.title && /personal|concern|query|question/i.test(s.title)
        );
        if (personalSection) {
          // Extract question from title like "Personal Concern: When will I get married?"
          const match = personalSection.title.match(/(?:Personal Concern|Query|Question)[:\s]+(.+)/i);
          if (match) return match[1].trim();
          // If title itself is the question marker, return a cleaned version
          return personalSection.title.replace(/^\d+\.\s*/, "").trim();
        }
      }
      return null;
    }

    const paidQuestions = paid.map((r) => getQuestion(r)).filter(Boolean);
    const unpaidQuestions = unpaid.map((r) => getQuestion(r)).filter(Boolean);
    const paidWithoutQuestion = paid.length - paidQuestions.length;
    const unpaidWithoutQuestion = unpaid.length - unpaidQuestions.length;

    // AI categorize with caching (separate caches for paid vs unpaid)
    const paidCategorized = await getCachedCategories(supabase, "questions_paid", paid.length, paidQuestions);
    const unpaidCategorized = await getCachedCategories(supabase, "questions_unpaid", unpaid.length, unpaidQuestions);

    // Group into categories with ALL questions shown
    function groupByCategory(categorized) {
      const groups = {};
      categorized.forEach(({ question, category }) => {
        if (!groups[category]) groups[category] = { count: 0, questions: [] };
        groups[category].count++;
        groups[category].questions.push(question);
      });
      return Object.entries(groups)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.count - a.count);
    }

    const paidCatsSorted = groupByCategory(paidCategorized);
    const unpaidCatsSorted = groupByCategory(unpaidCategorized);

    // ===== CONVERSION FUNNEL =====
    const timesToPay = paid
      .filter((r) => r.paid_at && r.created_at)
      .map((r) => Math.round((new Date(r.paid_at) - new Date(r.created_at)) / 60000));
    const avgTimeToPay = timesToPay.length > 0 ? Math.round(timesToPay.reduce((a, b) => a + b, 0) / timesToPay.length) : null;
    const medianTimeToPay = timesToPay.length > 0 ? timesToPay.sort((a, b) => a - b)[Math.floor(timesToPay.length / 2)] : null;
    const under5min = timesToPay.filter((t) => t <= 5).length;
    const under30min = timesToPay.filter((t) => t <= 30).length;
    const over1hr = timesToPay.filter((t) => t > 60).length;

    // ===== SOURCE PERFORMANCE =====
    const sourceStats = {};
    all.forEach((r) => {
      let source = "organic";
      if (r.attribution) {
        source = r.attribution.utm_source || (r.attribution.fbclid ? "facebook" : r.attribution.gclid ? "google" : "organic");
      }
      if (!sourceStats[source]) sourceStats[source] = { leads: 0, paid: 0 };
      sourceStats[source].leads++;
      if (r.payment_status === "paid") sourceStats[source].paid++;
    });
    const sourcesSorted = Object.entries(sourceStats)
      .map(([source, s]) => ({ source, ...s, convRate: s.leads > 0 ? ((s.paid / s.leads) * 100).toFixed(1) : "0" }))
      .sort((a, b) => b.leads - a.leads);

    return NextResponse.json({
      peakHours: { hourlyLeads, hourlyPaid, dailyLeads, dailyPaid, dayNames },
      demographics: { genderStats, deviceStats },
      geography: { topCities },
      questions: {
        paidTotal: paidQuestions.length,
        unpaidTotal: unpaidQuestions.length,
        paidWithoutQuestion,
        unpaidWithoutQuestion,
        paidCategories: paidCatsSorted,
        unpaidCategories: unpaidCatsSorted,
      },
      funnel: { avgTimeToPay, medianTimeToPay, under5min, under30min, over1hr, total: timesToPay.length },
      sources: sourcesSorted,
    });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
