import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Admin analytics API — computes insights from all reports data.
// GET /api/admin/analytics
// Header: Authorization: Bearer <ADMIN_SECRET>
export const maxDuration = 30;

// Auto-categorize personal questions into ad-relevant buckets
function categorizeQuestion(q) {
  if (!q) return null;
  const lower = q.toLowerCase();

  if (/career|job|promotion|work|profession|office|business opportunity|resign|switch/i.test(lower)) return "Career & Job";
  if (/marri|shadi|spouse|husband|wife|wedding|vivah|partner find|life partner/i.test(lower)) return "Marriage";
  if (/love|relationship|boyfriend|girlfriend|breakup|affair|dating|ex /i.test(lower)) return "Love & Relationships";
  if (/money|wealth|financ|income|salary|debt|loan|profit|loss|invest/i.test(lower)) return "Money & Finance";
  if (/business|startup|entrepre|freelance|company|venture|self.?employ/i.test(lower)) return "Business & Startup";
  if (/abroad|foreign|visa|immigra|settle abroad|go overseas|usa|canada|uk|australia|germany/i.test(lower)) return "Foreign & Travel";
  if (/health|illness|disease|body|mental|anxiety|depression|medical/i.test(lower)) return "Health";
  if (/education|study|exam|college|university|degree|masters|competitive/i.test(lower)) return "Education & Exams";
  if (/child|baby|pregnan|son|daughter|fertility|conceive/i.test(lower)) return "Children & Family";
  if (/property|house|flat|real estate|land|home/i.test(lower)) return "Property & Home";
  if (/when|timing|kab|future|next year|2026|2027|prediction/i.test(lower)) return "Timing & Predictions";
  if (/lucky|gemstone|remedy|upay|mantra|spiritual/i.test(lower)) return "Remedies & Spirituality";

  return "General / Other";
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
      .select("created_at, payment_status, gender, device_type, city, personal_question, attribution, paid_at, is_founder_member, has_12_month_guidance")
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

    // Day of week analysis
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

    // ===== QUESTIONS ANALYSIS =====
    const paidQuestions = paid.filter((r) => r.personal_question && r.personal_question.trim()).map((r) => r.personal_question.trim());
    const unpaidQuestions = unpaid.filter((r) => r.personal_question && r.personal_question.trim()).map((r) => r.personal_question.trim());

    // Categorize
    const paidCategories = {};
    paidQuestions.forEach((q) => {
      const cat = categorizeQuestion(q);
      if (!paidCategories[cat]) paidCategories[cat] = { count: 0, examples: [] };
      paidCategories[cat].count++;
      if (paidCategories[cat].examples.length < 5) paidCategories[cat].examples.push(q);
    });

    const unpaidCategories = {};
    unpaidQuestions.forEach((q) => {
      const cat = categorizeQuestion(q);
      if (!unpaidCategories[cat]) unpaidCategories[cat] = { count: 0, examples: [] };
      unpaidCategories[cat].count++;
      if (unpaidCategories[cat].examples.length < 5) unpaidCategories[cat].examples.push(q);
    });

    // Sort categories by count
    const paidCatsSorted = Object.entries(paidCategories)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count);
    const unpaidCatsSorted = Object.entries(unpaidCategories)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.count - a.count);

    // ===== CONVERSION FUNNEL =====
    // Time to pay (minutes)
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
