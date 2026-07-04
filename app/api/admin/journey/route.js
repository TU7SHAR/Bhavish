import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// GET /api/admin/journey
// Returns visitor journey analytics: consideration time, visit counts,
// returning vs impulse buyers, session breakdowns.
export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Fetch all visitor sessions (last 90 days to keep it manageable)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
    const { data: sessions } = await supabase
      .from("visitor_sessions")
      .select("visitor_id, session_id, page, timestamp, device_type, utm_source")
      .gte("timestamp", ninetyDaysAgo)
      .order("timestamp", { ascending: true });

    // Fetch reports that have a visitor_id (linked leads)
    const { data: reports } = await supabase
      .from("reports")
      .select("report_id, visitor_id, payment_status, created_at, paid_at, is_founder_free")
      .not("visitor_id", "is", null);

    const allSessions = sessions || [];
    const allReports = reports || [];

    // Group sessions by visitor_id
    const visitorMap = {};
    for (const s of allSessions) {
      if (!visitorMap[s.visitor_id]) visitorMap[s.visitor_id] = [];
      visitorMap[s.visitor_id].push(s);
    }

    // For each report with a visitor_id, compute journey metrics
    const journeys = [];
    for (const r of allReports) {
      if (!r.visitor_id) continue;
      const visits = visitorMap[r.visitor_id] || [];
      if (visits.length === 0) continue;

      const firstVisit = new Date(visits[0].timestamp);
      const paymentTime = r.paid_at ? new Date(r.paid_at) : (r.payment_status === "paid" ? new Date(r.created_at) : null);
      const leadCreated = new Date(r.created_at);

      // Unique sessions count
      const uniqueSessions = new Set(visits.map((v) => v.session_id)).size;
      // Total page views
      const totalViews = visits.length;
      // Pages visited (unique)
      const uniquePages = new Set(visits.map((v) => v.page)).size;

      // Consideration time: first visit → payment (in hours)
      let considerationHours = null;
      if (paymentTime) {
        considerationHours = Math.round((paymentTime - firstVisit) / (1000 * 3600) * 10) / 10;
      }

      // Decision speed: preview → payment (in minutes)
      const previewVisit = visits.find((v) => v.page === "/report/preview");
      let decisionMinutes = null;
      if (paymentTime && previewVisit) {
        decisionMinutes = Math.round((paymentTime - new Date(previewVisit.timestamp)) / (1000 * 60) * 10) / 10;
      }

      journeys.push({
        reportId: r.report_id,
        visitorId: r.visitor_id,
        paid: r.payment_status === "paid" && !r.is_founder_free,
        firstVisit: firstVisit.toISOString(),
        paymentTime: paymentTime ? paymentTime.toISOString() : null,
        considerationHours,
        decisionMinutes,
        uniqueSessions,
        totalViews,
        uniquePages,
      });
    }

    // Aggregate stats
    const paidJourneys = journeys.filter((j) => j.paid);
    const unpaidJourneys = journeys.filter((j) => !j.paid);

    // Returning vs impulse buyers (paid only)
    // Impulse: consideration time < 1 hour, single session
    // Returning: multiple sessions OR consideration > 1 hour
    const impulseBuyers = paidJourneys.filter((j) => j.uniqueSessions === 1 && (j.considerationHours || 0) < 1);
    const returningBuyers = paidJourneys.filter((j) => j.uniqueSessions > 1 || (j.considerationHours || 0) >= 1);

    // Average metrics (paid customers only)
    const avgConsideration = paidJourneys.length > 0
      ? Math.round(paidJourneys.reduce((s, j) => s + (j.considerationHours || 0), 0) / paidJourneys.length * 10) / 10
      : 0;
    const avgSessions = paidJourneys.length > 0
      ? Math.round(paidJourneys.reduce((s, j) => s + j.uniqueSessions, 0) / paidJourneys.length * 10) / 10
      : 0;
    const avgPageViews = paidJourneys.length > 0
      ? Math.round(paidJourneys.reduce((s, j) => s + j.totalViews, 0) / paidJourneys.length * 10) / 10
      : 0;
    const avgDecision = paidJourneys.filter((j) => j.decisionMinutes !== null).length > 0
      ? Math.round(paidJourneys.filter((j) => j.decisionMinutes !== null).reduce((s, j) => s + j.decisionMinutes, 0) / paidJourneys.filter((j) => j.decisionMinutes !== null).length * 10) / 10
      : 0;

    // Consideration time buckets (paid)
    const timeBuckets = { "<5 min": 0, "5-30 min": 0, "30min-1hr": 0, "1-6 hrs": 0, "6-24 hrs": 0, "1-3 days": 0, "3+ days": 0 };
    for (const j of paidJourneys) {
      const h = j.considerationHours || 0;
      if (h < 5 / 60) timeBuckets["<5 min"]++;
      else if (h < 0.5) timeBuckets["5-30 min"]++;
      else if (h < 1) timeBuckets["30min-1hr"]++;
      else if (h < 6) timeBuckets["1-6 hrs"]++;
      else if (h < 24) timeBuckets["6-24 hrs"]++;
      else if (h < 72) timeBuckets["1-3 days"]++;
      else timeBuckets["3+ days"]++;
    }

    // Sessions-before-purchase buckets (paid)
    const sessionBuckets = { "1 session": 0, "2 sessions": 0, "3 sessions": 0, "4+ sessions": 0 };
    for (const j of paidJourneys) {
      if (j.uniqueSessions === 1) sessionBuckets["1 session"]++;
      else if (j.uniqueSessions === 2) sessionBuckets["2 sessions"]++;
      else if (j.uniqueSessions === 3) sessionBuckets["3 sessions"]++;
      else sessionBuckets["4+ sessions"]++;
    }

    // Top pages visited by buyers (before payment)
    const pageVisits = {};
    for (const j of paidJourneys) {
      const visits = visitorMap[j.visitorId] || [];
      for (const v of visits) {
        if (j.paymentTime && new Date(v.timestamp) <= new Date(j.paymentTime)) {
          pageVisits[v.page] = (pageVisits[v.page] || 0) + 1;
        }
      }
    }
    const topPages = Object.entries(pageVisits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));

    // Total unique visitors tracked
    const totalVisitors = Object.keys(visitorMap).length;

    return NextResponse.json({
      summary: {
        totalVisitorsTracked: totalVisitors,
        linkedJourneys: journeys.length,
        paidJourneys: paidJourneys.length,
        impulseBuyers: impulseBuyers.length,
        returningBuyers: returningBuyers.length,
        avgConsiderationHours: avgConsideration,
        avgSessionsBeforePurchase: avgSessions,
        avgPageViewsBeforePurchase: avgPageViews,
        avgDecisionMinutes: avgDecision,
      },
      timeBuckets,
      sessionBuckets,
      topPages,
      // Recent journeys (last 20) for the detail table
      recentJourneys: journeys
        .sort((a, b) => new Date(b.firstVisit) - new Date(a.firstVisit))
        .slice(0, 20),
    });
  } catch (err) {
    console.error("Journey analytics error:", err);
    return NextResponse.json({ error: "Failed to compute journey analytics" }, { status: 500 });
  }
}
