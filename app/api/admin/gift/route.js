import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Admin-only: gift a customer either the 12-Month Guidance Pack or Founder Upgrade.
// POST /api/admin/gift
// Body: { reportId, type: "guidance" | "founder" }
// Auth: Bearer ADMIN_SECRET

export const maxDuration = 15;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function buildGiftEmail({ name, email, type }) {
  const isGuidance = type === "guidance";
  const title = isGuidance
    ? "You've been gifted the 12-Month Guidance Pack!"
    : "You've been gifted a Founder Membership!";
  const what = isGuidance
    ? `<p style="margin-bottom:16px;">We've added the <strong>12-Month Personal Guidance Pack</strong> to your account — completely free, as a gift from us.</p>
       <p style="margin-bottom:8px;"><strong>What's included:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Month-by-month forecast (career, money, love, health) for 12 months</li>
         <li>Best months for action & caution months</li>
         <li>Key timing windows — when to move, when to wait</li>
         <li>Practical monthly action plan & personal remedies</li>
         <li>12-month yearly summary & overall theme</li>
       </ul>
       <p style="margin-bottom:16px;">Your guidance is included as a <strong>dedicated section in your full report</strong>. Open your report from the My Reports page to see it.</p>`
    : `<p style="margin-bottom:16px;">We've upgraded your account to <strong>Founding Member</strong> status — completely free, as a gift from us.</p>
       <p style="margin-bottom:8px;"><strong>What this means:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Generate up to 5 free reports every month</li>
         <li>Use them for yourself, family, or friends</li>
         <li>Valid for 24 months (up to 120 total reports)</li>
         <li>Access via bhavishai.in → Google Sign In → My Reports → Generate Free Report</li>
       </ul>`;

  const trackType = isGuidance ? "gift_guidance" : "gift_founder";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;padding:0;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#a78bfa;margin:0;">✨ BhavishAI</h1>
    </div>
    <div style="background:#1a1a2e;border:1px solid #2d2d44;border-radius:16px;padding:32px;">
      <h2 style="color:#fbbf24;margin-top:0;">🎁 ${title}</h2>
      <p style="margin-bottom:16px;">Hi <strong>${name}</strong>,</p>
      ${what}
      <div style="text-align:center;margin:24px 0;">
        <a href="https://www.bhavishai.in/dashboard" style="display:inline-block;background:#8b5cf6;color:white;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:600;font-size:15px;">Open My Reports →</a>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin-bottom:0;">Questions? Just reply to this email.</p>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:24px;">&copy; ${new Date().getFullYear()} BhavishAI | bhavishai.in</p>
  </div>
  <img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent("gift")}&type=${trackType}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
}

export async function POST(request) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { reportId, type } = await request.json();

    if (!reportId || !["guidance", "founder"].includes(type)) {
      return NextResponse.json({ error: "reportId and type (guidance|founder) required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the report
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, email, has_12_month_guidance, is_founder_member")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (!report.email) {
      return NextResponse.json({ error: "This customer has no email — cannot send gift notification." }, { status: 400 });
    }

    // Already has it?
    if (type === "guidance" && report.has_12_month_guidance) {
      return NextResponse.json({ error: "This customer already has the 12-Month Guidance Pack." }, { status: 400 });
    }
    if (type === "founder" && report.is_founder_member) {
      return NextResponse.json({ error: "This customer is already a Founder Member." }, { status: 400 });
    }

    // Update the DB
    const now = new Date();
    let updateData = {};
    if (type === "guidance") {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 12);
      updateData = {
        has_12_month_guidance: true,
        guidance_start_date: now.toISOString(),
        guidance_end_date: endDate.toISOString(),
        is_guidance_gifted: true,
      };
    } else {
      updateData = {
        is_founder_member: true,
        is_founder_gifted: true,
      };
    }

    const { error: updateErr } = await supabase
      .from("reports")
      .update(updateData)
      .eq("report_id", reportId);

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 });
    }

    // Send the gift email
    const html = buildGiftEmail({ name: report.name, email: report.email, type });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const subject = type === "guidance"
      ? `🎁 You've been gifted the 12-Month Guidance Pack — ${report.name}`
      : `🎁 You've been gifted a Founder Membership — ${report.name}`;

    let emailSent = false;
    try {
      const { error: sendErr } = await resend.emails.send({
        from: `BhavishAI <${fromEmail}>`,
        to: [report.email],
        subject,
        html,
        reply_to: process.env.GMAIL_USER || fromEmail,
      });
      if (sendErr) throw new Error(sendErr.message);
      emailSent = true;
    } catch (emailErr) {
      console.error("Gift email failed:", emailErr.message);
      // Still return success for the DB update — admin can resend manually
    }

    const label = type === "guidance" ? "12-Month Guidance Pack" : "Founder Membership";
    return NextResponse.json({
      success: true,
      email: report.email,
      message: emailSent
        ? `Gifted ${label} to ${report.name} and sent notification email.`
        : `Gifted ${label} to ${report.name} (DB updated) but email failed — use resend button.`,
      emailSent,
    });
  } catch (error) {
    console.error("Gift error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
