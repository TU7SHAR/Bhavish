import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Test/QA accounts to exclude from ALL admin metrics and lists.
// Set TEST_ACCOUNT_EMAILS in env as a comma-separated list, e.g.
//   TEST_ACCOUNT_EMAILS="my-test@gmail.com, qa@bhavishai.in"
function getTestEmails() {
  return (process.env.TEST_ACCOUNT_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
function excludeTest(rows, testEmails) {
  if (!testEmails.length) return rows || [];
  return (rows || []).filter((r) => !(r.email && testEmails.includes(r.email.toLowerCase())));
}

// Free founder-generated reports are NOT genuine leads/customers — they're an
// existing founder using their unlimited perk. Exclude them from lead-observation
// views (Leads, Everyone). NOTE: this only removes payment_status='founder' /
// is_founder_free rows; real paying founders (payment_status='paid' with
// is_founder_member=true) are kept, since they ARE real customers.
function excludeFounderGen(rows) {
  return (rows || []).filter((r) => r.payment_status !== "founder" && !r.is_founder_free);
}

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
  // SECURITY FIX: Use timing-safe comparison for admin auth
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "overview";

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    if (tab === "overview") {
      // Aggregated stats.
      //
      // IMPORTANT: Supabase caps a single .select() at 1000 rows. The old code
      // used `.select("*")` with no ordering, which silently returned only the
      // FIRST 1000 rows (default primary-key order = oldest first). Once the
      // table grew past 1000 rows, recent paid customers were dropped from every
      // Overview metric even though they were perfectly valid — the exact bug
      // where a real, correctly-paid report never appeared in the dashboard.
      //
      // Fix: fetch ALL rows via explicit pagination, and select ONLY the
      // lightweight columns the aggregation actually needs (never the heavy
      // JSONB like sections/chart_data/full_text). This both counts every row
      // and makes the Overview far faster.
      const OVERVIEW_COLUMNS =
        "email,payment_status,is_founder_free,is_founder_member,is_founder_gifted," +
        "founder_upgrade_payment_id,has_12_month_guidance,is_guidance_gifted," +
        "plan_tier,plan_price,paid_at,created_at,email_sequence_status," +
        "emails_sent_count,email_opens,email_drafts,thankyou_sent_at";

      const allReports = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data: page, error: pageErr } = await supabase
          .from("reports")
          .select(OVERVIEW_COLUMNS)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE - 1);
        if (pageErr) {
          console.error("[admin/overview] page fetch error:", pageErr.message);
          break;
        }
        if (!page || page.length === 0) break;
        allReports.push(...page);
        if (page.length < PAGE) break; // last page
      }

      // Exclude test/QA accounts from every metric
      const reports = excludeTest(allReports, getTestEmails());
      const totalLeads = reports.length;
      const totalPaid = reports.filter((r) => r.payment_status === "paid" && !r.is_founder_free).length;
      const totalUnpaid = reports.filter((r) => r.payment_status === "unpaid").length;
      const totalFounderFree = reports.filter((r) => r.payment_status === "founder" || r.is_founder_free).length;

      // All genuinely paid reports (not founder-free). Used for revenue + tier stats.
      const paidReportsAll = reports.filter((r) => r.payment_status === "paid" && !r.is_founder_free);

      // Accurate revenue calculation — THREE-TIER AWARE.
      // Uses plan_price from the DB when available (set by verify-payment for new
      // purchases). Falls back to the legacy formula for older rows that predate
      // the three-tier model (paid*299 + founder upgrades*999 + guidance*149).
      //
      // Gifted tiers are excluded from revenue (no real payment occurred).
      const founderMembers = reports.filter((r) => r.is_founder_member).length;
      const founderMembersPaid = reports.filter((r) => r.founder_upgrade_payment_id).length;
      const with12MonthGuidance = reports.filter((r) => r.has_12_month_guidance).length;
      const with12MonthGuidancePaid = reports.filter((r) => r.has_12_month_guidance && r.is_guidance_gifted !== true && r.payment_status === "paid").length;

      // Helper: get the actual revenue for a single paid report.
      // plan_price is set for new 3-tier purchases; legacy rows use the formula.
      function reportRevenue(r) {
        if (r.plan_price && typeof r.plan_price === "number") return r.plan_price;
        // Legacy fallback: ₹299 base + ₹149 guidance (if paid, not gifted)
        let rev = 299;
        if (r.has_12_month_guidance && r.is_guidance_gifted !== true) rev += 149;
        return rev;
      }

      // Total revenue from report purchases (excludes founder upgrades — counted separately).
      const reportRevenueTotal = paidReportsAll.reduce((sum, r) => sum + reportRevenue(r), 0);
      const founderRevenue = founderMembersPaid * 999;
      const totalRevenue = reportRevenueTotal + founderRevenue;

      // Per-tier breakdown (new 3-tier model). Legacy rows (plan_tier=null or premium_legacy)
      // are counted under "Legacy (Pre-Tier)" for clarity.
      const tierCounts = { essential: 0, premium: 0, master: 0, legacy: 0 };
      const tierRevenue = { essential: 0, premium: 0, master: 0, legacy: 0 };
      for (const r of paidReportsAll) {
        const t = r.plan_tier;
        if (t === "essential") { tierCounts.essential++; tierRevenue.essential += reportRevenue(r); }
        else if (t === "premium") { tierCounts.premium++; tierRevenue.premium += reportRevenue(r); }
        else if (t === "master") { tierCounts.master++; tierRevenue.master += reportRevenue(r); }
        else { tierCounts.legacy++; tierRevenue.legacy += reportRevenue(r); }
      }
      const aov = totalPaid > 0 ? Math.round(totalRevenue / totalPaid) : 0;

      // Razorpay fee: 2% + 18% GST on the 2% = 2.36% effective
      const RAZORPAY_FEE_PERCENT = 2.36;
      const totalFees = Math.round(totalRevenue * RAZORPAY_FEE_PERCENT / 100);
      const netRevenue = totalRevenue - totalFees;

      // Settlement calculation — Razorpay settles a WHOLE DAY's money together,
      // T+N days after the payment date (default T+2). We batch by IST calendar
      // day, NOT a rolling hourly clock. So all of e.g. Thursday's payments flip
      // to "settled" together on Saturday — never a partial amount.
      // Tune SETTLEMENT_DELAY_DAYS in env if your Razorpay cycle differs (T+1, etc).
      const SETTLEMENT_DELAY_DAYS = parseInt(process.env.SETTLEMENT_DELAY_DAYS || "2");
      const IST_MS = 5.5 * 60 * 60 * 1000;
      const DAY_MS = 24 * 60 * 60 * 1000;
      // Midnight (IST) of the day a given timestamp falls on, returned as a UTC ms value
      const istDayStart = (ts) => {
        const ist = new Date(new Date(ts).getTime() + IST_MS);
        return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_MS;
      };
      const todayStartMs = istDayStart(Date.now());

      const paidReports = paidReportsAll; // same set, named for settlement logic below

      // A payment is settled once (its payment day + delay) has arrived.
      const isSettled = (r) => {
        const payDate = r.paid_at || r.created_at;
        if (!payDate) return false;
        const settleDayMs = istDayStart(payDate) + SETTLEMENT_DELAY_DAYS * DAY_MS;
        return settleDayMs <= todayStartMs;
      };
      const settledReports = paidReports.filter(isSettled);
      const pendingReports = paidReports.filter((r) => !isSettled(r));

      // Calculate settled/pending amounts (uses plan_price when available)
      function calcRevenue(list) {
        const reportGross = list.reduce((sum, r) => sum + reportRevenue(r), 0);
        const founder = list.filter((r) => r.founder_upgrade_payment_id).length * 999;
        const gross = reportGross + founder;
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
      const recentPaid = reports.filter((r) => r.payment_status === "paid" && !r.is_founder_free && (r.paid_at || r.created_at) >= sevenDaysAgo).length;

      // Today (IST = UTC+5:30) — Vercel runs in UTC, so we need to calculate IST midnight
      const nowUTC = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000; // 5h 30m in ms
      const nowIST = new Date(nowUTC.getTime() + istOffset);
      const todayStart = new Date(Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - istOffset);
      const todayISO = todayStart.toISOString();
      const todayLeads = reports.filter((r) => r.created_at >= todayISO).length;
      const todayPaid = reports.filter((r) => r.payment_status === "paid" && !r.is_founder_free && (r.paid_at || r.created_at) >= todayISO).length;

      return NextResponse.json({
        overview: {
          totalLeads: totalLeads || reports.length,
          totalPaid,
          totalUnpaid,
          totalFounderFree,
          totalRevenue,
          netRevenue,
          totalFees,
          founderRevenue,
          aov,
          // Per-tier breakdown (new three-tier model)
          tierCounts,
          tierRevenue,
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
          // Lightweight array for client-side date filtering
          reportDates: reports.map((r) => ({
            created_at: r.created_at,
            payment_status: r.payment_status,
            is_founder_member: !!r.is_founder_member,
            is_founder_free: !!r.is_founder_free,
            is_founder_gifted: !!r.is_founder_gifted,
            founder_upgrade_payment_id: r.founder_upgrade_payment_id || null,
            has_12_month_guidance: !!r.has_12_month_guidance,
            is_guidance_gifted: !!r.is_guidance_gifted,
            paid_at: r.paid_at || null,
            plan_tier: r.plan_tier || null,
            plan_price: r.plan_price || null,
          })),
        },
      });
    }

    if (tab === "leads") {
      // Using select("*") so it works whether or not the new columns exist yet
      const { data: leads } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      // Strip heavy fields to keep response small. Exclude test accounts AND
      // free founder generations (they aren't genuine leads).
      const cleanLeads = excludeFounderGen(excludeTest(leads, getTestEmails()));
      const slim = cleanLeads.map(({ sections, email_drafts, summary, ...rest }) => rest);
      return NextResponse.json({ leads: slim });
    }

    if (tab === "payments") {
      const { data: payments } = await supabase
        .from("reports")
        .select("report_id, name, email, payment_status, payment_id, created_at, has_12_month_guidance, is_founder_member, founder_upgrade_payment_id, is_guidance_gifted, is_founder_gifted")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      return NextResponse.json({ payments: excludeTest(payments, getTestEmails()) });
    }

    if (tab === "paid-details") {
      // Genuinely PAID customers only — founder-free reports live in their own tab
      const { data: paid } = await supabase
        .from("reports")
        .select("*")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      return NextResponse.json({ paid: excludeTest(paid, getTestEmails()) });
    }

    if (tab === "founders") {
      // ALL founder-related rows: paying members (₹999) + their free generations.
      // Split into sub-tabs on the client. Test accounts excluded.
      const { data: founders } = await supabase
        .from("reports")
        .select("*")
        .or("is_founder_member.eq.true,payment_status.eq.founder,is_founder_free.eq.true")
        .order("created_at", { ascending: false });

      return NextResponse.json({ founders: excludeTest(founders, getTestEmails()) });
    }

    if (tab === "guidance-customers") {
      // Everyone who bought the ₹149 12-Month Guidance add-on. Test accounts
      // excluded; genuine customers only (founder-free gens are irrelevant here
      // but we keep any real row that has the flag set).
      const { data: guidance } = await supabase
        .from("reports")
        .select("*")
        .eq("has_12_month_guidance", true)
        .order("created_at", { ascending: false });

      return NextResponse.json({ guidanceCustomers: excludeTest(guidance, getTestEmails()) });
    }

    if (tab === "guidance-monthly") {
      // Fetch monthly guidance reports for a specific customer (by reportId query param)
      const reportId = searchParams.get("reportId");
      if (!reportId) return NextResponse.json({ monthlyReports: [] });

      const { data: monthlyReports, error: mrErr } = await supabase
        .from("guidance_reports")
        .select("*")
        .eq("parent_report_id", reportId)
        .order("month_number", { ascending: true });

      if (mrErr) {
        // Table might not exist yet — return empty gracefully
        if (mrErr.message?.includes("relation") || mrErr.code === "42P01") {
          return NextResponse.json({ monthlyReports: [] });
        }
        return NextResponse.json({ error: mrErr.message }, { status: 500 });
      }

      return NextResponse.json({ monthlyReports: monthlyReports || [] });
    }

    if (tab === "test") {
      // Everything tied to the test/QA account(s) — isolated here, out of all metrics.
      const testEmails = getTestEmails();
      if (!testEmails.length) return NextResponse.json({ test: [] });
      const { data: allRows } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      const testRows = (allRows || []).filter(
        (r) => r.email && testEmails.includes(r.email.toLowerCase())
      );
      return NextResponse.json({ test: testRows });
    }

    if (tab === "all-details") {
      // Every genuine lead — excludes test accounts and free founder generations
      // (founder generations have their own "Founder Reports" tab).
      const { data: all } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });

      return NextResponse.json({ all: excludeFounderGen(excludeTest(all, getTestEmails())) });
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
        .select("report_id, name, email, created_at, payment_status, emails_sent_count, last_email_sent_at, email_sequence_status, email_opens, email_drafts, thankyou_sent_at, guidance_email_sent_at, howto_sent_at, has_12_month_guidance")
        .not("email", "is", null)
        .neq("email", "")
        .order("created_at", { ascending: false });

      // Include full drafts (subject + body + psychology) so admin can read the actual email text
      const enriched = excludeTest(emails, getTestEmails()).map((e) => ({
        ...e,
        email_drafts: Array.isArray(e.email_drafts)
          ? e.email_drafts.map((d) => ({ num: d.num, subject: d.subject, body: d.body, psychology: d.psychology }))
          : null,
      }));

      return NextResponse.json({ emails: enriched });
    }

    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  } catch (error) {
    console.error("Admin data error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
