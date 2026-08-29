import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin diagnostic — explains EXACTLY why a given report row is or isn't
// counted in the Overview tab. Use this when a real payment appears in
// Razorpay but not in the admin dashboard.
//
// GET /api/admin/diagnose-report?reportId=RPT-...
//   or ?email=someone@example.com   (finds the most recent row for that email)
//   Header: Authorization: Bearer <ADMIN_SECRET or CRON_SECRET>
//
// Returns the raw row fields that gate Overview inclusion plus a plain-English
// verdict on why it is / isn't showing up. Does NOT modify anything.
export const maxDuration = 30;

function getTestEmails() {
  return (process.env.TEST_ACCOUNT_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");
  const email = searchParams.get("email");

  if (!reportId && !email) {
    return NextResponse.json({ error: "Pass ?reportId=RPT-... or ?email=..." }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    let row;
    if (reportId) {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("report_id", reportId)
        .single();
      if (error || !data) {
        return NextResponse.json({ found: false, reason: `No row with report_id=${reportId}`, dbError: error?.message || null }, { status: 200 });
      }
      row = data;
    } else {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error || !data || data.length === 0) {
        return NextResponse.json({ found: false, reason: `No row with email=${email}`, dbError: error?.message || null }, { status: 200 });
      }
      row = data[0];
    }

    // The exact gates the Overview tab applies (mirrors app/api/admin/data/route.js).
    const testEmails = getTestEmails();
    const emailLower = (row.email || "").toLowerCase();
    const isTestExcluded = !!(row.email && testEmails.includes(emailLower));
    const isPaidStatus = row.payment_status === "paid";
    const isFounderFree = !!row.is_founder_free;
    const countedInOverview = !isTestExcluded && isPaidStatus && !isFounderFree;

    // Revenue this row would contribute (same logic as Overview).
    let revenueContribution = 0;
    if (countedInOverview) {
      if (typeof row.plan_price === "number" && row.plan_price) {
        revenueContribution = row.plan_price;
      } else {
        revenueContribution = 299 + (row.has_12_month_guidance && row.is_guidance_gifted !== true ? 149 : 0);
      }
    }

    // Build a plain-English verdict.
    const reasons = [];
    if (isTestExcluded) {
      reasons.push(`❌ EXCLUDED: this email is in TEST_ACCOUNT_EMAILS, so the row is stripped from ALL Overview metrics. Remove "${emailLower}" from TEST_ACCOUNT_EMAILS in Vercel env (and redeploy) to make it count.`);
    }
    if (!isPaidStatus) {
      reasons.push(`❌ NOT PAID: payment_status is "${row.payment_status ?? "null"}", not "paid". The DB row was never marked paid — fulfillment did not complete (UPI browser callback didn't fire and/or webhook not configured). Run reconciliation on this reportId to fix it.`);
    }
    if (isFounderFree) {
      reasons.push(`❌ FOUNDER-FREE: is_founder_free is true, so it's treated as a free founder generation, not a paying customer.`);
    }
    if (countedInOverview) {
      reasons.push(`✅ COUNTED: this row IS included in Overview and contributes ₹${revenueContribution} to gross revenue. If you still don't see it, check that the Overview date filter is set to "All Time" (a Today/7-day filter uses paid_at/created_at and may exclude older rows).`);
    }

    return NextResponse.json({
      found: true,
      countedInOverview,
      revenueContribution,
      verdict: reasons,
      gates: {
        isTestExcluded,
        isPaidStatus,
        isFounderFree,
        testEmailsConfigured: testEmails.length,
        emailMatchesTestList: isTestExcluded,
      },
      row: {
        report_id: row.report_id,
        name: row.name,
        email: row.email,
        payment_status: row.payment_status,
        payment_id: row.payment_id,
        plan_tier: row.plan_tier,
        plan_price: row.plan_price,
        paid_at: row.paid_at,
        report_status: row.report_status,
        has_12_month_guidance: row.has_12_month_guidance,
        is_founder_free: row.is_founder_free,
        is_guidance_gifted: row.is_guidance_gifted,
        email_sent_at: row.email_sent_at,
        created_at: row.created_at,
      },
    });
  } catch (error) {
    console.error("[diagnose-report] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
