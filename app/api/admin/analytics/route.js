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
      .select("email, created_at, payment_status, gender, device_type, city, personal_question, attribution, paid_at, is_founder_member, has_12_month_guidance, is_guidance_gifted, is_founder_gifted, founder_upgrade_payment_id, sections")
      .order("created_at", { ascending: false });

    // Exclude test/QA accounts (TEST_ACCOUNT_EMAILS) from all analytics
    const testEmails = (process.env.TEST_ACCOUNT_EMAILS || "")
      .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    const all = (reports || []).filter((r) => !(r.email && testEmails.includes(r.email.toLowerCase())));
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

    // Per-DATE breakdown (each unique calendar date in IST)
    const dateMap = {};
    function istDateKey(ts) {
      const d = new Date(new Date(ts).getTime() + IST_OFFSET);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }
    all.forEach((r) => {
      const key = istDateKey(r.created_at);
      if (!dateMap[key]) dateMap[key] = { date: key, leads: 0, paid: 0, revenue: 0 };
      dateMap[key].leads++;
    });
    paid.forEach((r) => {
      const key = istDateKey(r.paid_at || r.created_at);
      if (!dateMap[key]) dateMap[key] = { date: key, leads: 0, paid: 0, revenue: 0 };
      dateMap[key].paid++;
      // Revenue: ₹299 base + ₹999 founder (only if they have a real payment ID, not gifted)
      // + ₹149 guidance (only if not gifted)
      const founderRev = r.founder_upgrade_payment_id ? 999 : 0;
      const guidanceRev = (r.has_12_month_guidance && r.is_guidance_gifted !== true) ? 149 : 0;
      dateMap[key].revenue += 299 + founderRev + guidanceRev;
    });
    const dailyBreakdown = Object.values(dateMap).sort((a, b) => new Date(b.date) - new Date(a.date));

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
    // 2. A dedicated "Personal Concern" section in the FULL report (older paid leads)
    // IMPORTANT: must match the exact phrase "Personal Concern" — NOT "Personality"
    // (preview sections like "Rashi & Personality Overview" must NOT match)
    function getQuestion(r) {
      if (r.personal_question && r.personal_question.trim()) return r.personal_question.trim();
      // Fallback: only match a real "Personal Concern:" section (section 21 of full report)
      if (Array.isArray(r.sections)) {
        const personalSection = r.sections.find((s) =>
          s.title && /personal concern/i.test(s.title)
        );
        if (personalSection) {
          const match = personalSection.title.match(/personal concern[:\s-]+(.+)/i);
          if (match) return match[1].trim();
        }
      }
      return null;
    }

    // Build {question, date} objects (keep the date for display + sorting)
    const paidQ = paid.map((r) => ({ q: getQuestion(r), date: r.paid_at || r.created_at })).filter((x) => x.q);
    const unpaidQ = unpaid.map((r) => ({ q: getQuestion(r), date: r.created_at })).filter((x) => x.q);

    const paidQuestions = paidQ.map((x) => x.q);
    const unpaidQuestions = unpaidQ.map((x) => x.q);
    const paidWithoutQuestion = paid.length - paidQuestions.length;
    const unpaidWithoutQuestion = unpaid.length - unpaidQuestions.length;

    // AI categorize with caching (separate caches for paid vs unpaid).
    // cacheKey includes "v2" so the old (buggy) cache is invalidated automatically.
    const paidCategorized = await getCachedCategories(supabase, "questions_paid_v2", paid.length, paidQuestions);
    const unpaidCategorized = await getCachedCategories(supabase, "questions_unpaid_v2", unpaid.length, unpaidQuestions);

    // Attach dates back to categorized questions (match by question text + order)
    function attachDates(categorized, sourceQ) {
      const used = new Set();
      return categorized.map((c) => {
        // find the first matching source entry not yet used
        const idx = sourceQ.findIndex((s, i) => !used.has(i) && s.q === c.question);
        if (idx >= 0) { used.add(idx); return { ...c, date: sourceQ[idx].date }; }
        return { ...c, date: null };
      });
    }
    const paidWithDates = attachDates(paidCategorized, paidQ);
    const unpaidWithDates = attachDates(unpaidCategorized, unpaidQ);

    // Group into categories with ALL questions shown, newest first within each category
    function groupByCategory(categorized) {
      const groups = {};
      categorized.forEach(({ question, category, date }) => {
        if (!groups[category]) groups[category] = { count: 0, questions: [] };
        groups[category].count++;
        groups[category].questions.push({ text: question, date });
      });
      // sort questions in each category by date (newest first)
      Object.values(groups).forEach((g) => {
        g.questions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
      });
      return Object.entries(groups)
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.count - a.count);
    }

    const paidCatsSorted = groupByCategory(paidWithDates);
    const unpaidCatsSorted = groupByCategory(unpaidWithDates);

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
      peakHours: { hourlyLeads, hourlyPaid, dailyLeads, dailyPaid, dayNames, dailyBreakdown },
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
