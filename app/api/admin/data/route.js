import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Super admin API — returns ALL data for the admin dashboard.
// Protected by ADMIN_SECRET env var (or falls back to CRON_SECRET).
//
// GET /api/admin/data
// Header: Authorization: Bearer <ADMIN_SECRET>
//
// Query params:
//   ?tab=overview    → stats summary
//   ?tab=leads       → all leads with email status
//   ?tab=payments    → paid reports only
//   ?tab=emails      → email delivery + open tracking
export const maxDuration = 30;

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "overview";

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (tab === "overview") {
      // Aggregated stats
      const { data: allReports, count: totalLeads } = await supabase
        .from("reports")
        .select("*", { count: "exact" });

      const reports = allReports || [];
      const totalPaid = reports.filter((r) => r.payment_status === "paid").length;
      const totalUnpaid = reports.filter((r) => r.payment_status === "unpaid").length;
      const totalRevenue = totalPaid * 299; // base price
      const withEmail = reports.filter((r) => r.email && r.email.trim()).length;
      const withDrafts = reports.filter((r) => r.email_drafts && Array.isArray(r.email_drafts)).length;
      const emailsActive = reports.filter((r) => r.email_sequence_status === "active").length;
      const emailsCompleted = reports.filter((r) => r.email_sequence_status === "completed").length;
      
      // Email opens
      const withOpens = reports.filter((r) => r.email_opens && Array.isArray(r.email_opens) && r.email_opens.length > 0).length;
      const totalEmailsSent = reports.reduce((sum, r) => sum + (r.emails_sent_count || 0), 0);
      const totalOpens = reports.reduce((sum, r) => {
        return sum + (Array.isArray(r.email_opens) ? r.email_opens.length : 0);
      }, 0);

      // Founder upgrades
      const founderMembers = reports.filter((r) => r.is_founder_member).length;
      const with12MonthGuidance = reports.filter((r) => r.has_12_month_guidance).length;

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const recentLeads = reports.filter((r) => r.created_at >= sevenDaysAgo).length;
      const recentPaid = reports.filter((r) => r.payment_status === "paid" && r.created_at >= sevenDaysAgo).length;

      // Today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();
      const todayLeads = reports.filter((r) => r.created_at >= todayISO).length;
      const todayPaid = reports.filter((r) => r.payment_status === "paid" && r.created_at >= todayISO).length;

      return NextResponse.json({
        overview: {
          totalLeads: totalLeads || reports.length,
          totalPaid,
          totalUnpaid,
          totalRevenue,
          founderMembers,
          with12MonthGuidance,
          conversionRate: totalLeads ? ((totalPaid / totalLeads) * 100).toFixed(1) : "0",
          withEmail,
          withDrafts,
          emailsActive,
          emailsCompleted,
          totalEmailsSent,
          totalOpens,
          withOpens,
          openRate: totalEmailsSent ? ((totalOpens / totalEmailsSent) * 100).toFixed(1) : "0",
          recentLeads,
          recentPaid,
          todayLeads,
          todayPaid,
        },
      });
    }

    if (tab === "leads") {
      const { data: leads } = await supabase
        .from("reports")
        .select("report_id, name, email, gender, date_of_birth, place_of_birth, payment_status, payment_id, created_at, emails_sent_count, email_sequence_status, email_opens, has_12_month_guidance, is_founder_member")
        .order("created_at", { ascending: false });

      return NextResponse.json({ leads: leads || [] });
    }

    if (tab === "payments") {
      const { data: payments } = await supabase
        .from("reports")
        .select("report_id, name, email, payment_status, payment_id, created_at, has_12_month_guidance, is_founder_member, founder_upgrade_payment_id")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      return NextResponse.json({ payments: payments || [] });
    }

    if (tab === "emails") {
      const { data: emails } = await supabase
        .from("reports")
        .select("report_id, name, email, created_at, emails_sent_count, last_email_sent_at, email_sequence_status, email_opens, email_drafts")
        .not("email", "is", null)
        .neq("email", "")
        .order("created_at", { ascending: false });

      // Simplify email_drafts to just subjects (full drafts are too large)
      const simplified = (emails || []).map((e) => ({
        ...e,
        email_drafts: Array.isArray(e.email_drafts)
          ? e.email_drafts.map((d) => ({ num: d.num, subject: d.subject, psychology: d.psychology }))
          : null,
      }));

      return NextResponse.json({ emails: simplified });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (error) {
    console.error("Admin data error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
