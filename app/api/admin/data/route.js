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

      // Accurate revenue calculation (accounts for all products)
      const founderMembers = reports.filter((r) => r.is_founder_member).length;
      const with12MonthGuidance = reports.filter((r) => r.has_12_month_guidance).length;
      const baseRevenue = totalPaid * 299;
      const founderRevenue = founderMembers * 999;
      const guidanceRevenue = with12MonthGuidance * 149;
      const totalRevenue = baseRevenue + founderRevenue + guidanceRevenue;

      // Razorpay fee: 2% + 18% GST on the 2% = 2.36% effective
      const RAZORPAY_FEE_PERCENT = 2.36;
      const totalFees = Math.round(totalRevenue * RAZORPAY_FEE_PERCENT / 100);
      const netRevenue = totalRevenue - totalFees;

      // Settlement calculation: Razorpay settles T+2 business days
      // We use 3 calendar days as a safe buffer (covers weekends)
      const SETTLEMENT_DAYS = 3;
      const settlementCutoff = new Date(Date.now() - SETTLEMENT_DAYS * 24 * 3600 * 1000).toISOString();

      const paidReports = reports.filter((r) => r.payment_status === "paid");

      // Settled = paid before cutoff date
      const settledReports = paidReports.filter((r) => {
        const payDate = r.paid_at || r.created_at;
        return payDate && payDate < settlementCutoff;
      });
      // Pending = paid after cutoff date (recent payments)
      const pendingReports = paidReports.filter((r) => {
        const payDate = r.paid_at || r.created_at;
        return !payDate || payDate >= settlementCutoff;
      });

      // Calculate settled/pending amounts per product
      function calcRevenue(list) {
        const base = list.length * 299;
        const founder = list.filter((r) => r.is_founder_member).length * 999;
        const guidance = list.filter((r) => r.has_12_month_guidance).length * 149;
        const gross = base + founder + guidance;
        const fees = Math.round(gross * RAZORPAY_FEE_PERCENT / 100);
        return { gross, net: gross - fees, fees };
      }

      const settled = calcRevenue(settledReports);
      const pending = calcRevenue(pendingReports);
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

      // Recent activity (last 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const recentLeads = reports.filter((r) => r.created_at >= sevenDaysAgo).length;
      const recentPaid = reports.filter((r) => r.payment_status === "paid" && r.created_at >= sevenDaysAgo).length;

      // Today (IST = UTC+5:30) — Vercel runs in UTC, so we need to calculate IST midnight
      const nowUTC = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5h 30m in ms
      const nowIST = new Date(nowUTC.getTime() + istOffset);
      const todayStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - istOffset);
      const todayISO = todayStart.toISOString();
      const todayLeads = reports.filter((r) => r.created_at >= todayISO).length;
      const todayPaid = reports.filter((r) => r.payment_status === "paid" && r.created_at >= todayISO).length;

      return NextResponse.json({
        overview: {
          totalLeads: totalLeads || reports.length,
          totalPaid,
          totalUnpaid,
          totalRevenue,
          netRevenue,
          totalFees,
          baseRevenue,
          founderRevenue,
          guidanceRevenue,
          settledAmount: settled.net,
          settledGross: settled.gross,
          settledFees: settled.fees,
          pendingAmount: pending.net,
          pendingGross: pending.gross,
          pendingFees: pending.fees,
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
          // Paid email tracking
          paidReportOpened: reports.filter((r) => r.payment_status === "paid" && Array.isArray(r.email_opens) && r.email_opens.some((o) => o.type === "report")).length,
          paidThankYouOpened: reports.filter((r) => r.payment_status === "paid" && Array.isArray(r.email_opens) && r.email_opens.some((o) => o.type === "thankyou")).length,
          paidThankYouSent: reports.filter((r) => r.thankyou_sent_at).length,
        },
      });
    }

    if (tab === "leads") {
      // Using select("*") so it works whether or not the new columns exist yet
      const { data: leads } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      // Strip heavy fields to keep response small
      const slim = (leads || []).map(({ sections, email_drafts, summary, ...rest }) => rest);
      return NextResponse.json({ leads: slim });
    }

    if (tab === "payments") {
      const { data: payments } = await supabase
        .from("reports")
        .select("report_id, name, email, payment_status, payment_id, created_at, has_12_month_guidance, is_founder_member, founder_upgrade_payment_id")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      return NextResponse.json({ payments: payments || [] });
    }

    if (tab === "paid-details") {
      // EVERY column for paid customers — full report data, payment, upgrades, emails, everything
      const { data: paid } = await supabase
        .from("reports")
        .select("*")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      return NextResponse.json({ paid: paid || [] });
    }

    if (tab === "all-details") {
      // EVERY column for EVERY single lead — the raw dump
      const { data: all } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      return NextResponse.json({ all: all || [] });
    }

    if (tab === "blog") {
      const { data: blogPosts } = await supabase
        .from("blog_posts")
        .select("slug, title, description, read_minutes, published, created_at")
        .order("created_at", { ascending: false });

      return NextResponse.json({ blogPosts: blogPosts || [] });
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
