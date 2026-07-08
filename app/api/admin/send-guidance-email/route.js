import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin endpoint: send the "12-Month Guidance Pack purchased" confirmation email.
// Used both as the auto-confirmation on purchase and as a manual resend button.
// POST /api/admin/send-guidance-email
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId }
export const maxDuration = 30;

function buildGuidanceHtml(name, reportId) {
  const firstName = (name || "there").split(" ")[0];
  const trackingPixel = `https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=guidance`;

  return `
    <div style="font-family: Georgia, serif; max-width: 540px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
      <h2 style="color: #7c3aed; font-size: 20px; margin-bottom: 8px;">Your 12-Month Guidance Pack is confirmed 🎉</h2>
      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">Hi ${firstName},</p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        Thank you for adding the <strong>12-Month Personal Guidance Pack</strong> to your report. This is one of the most detailed parts of your reading.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 8px;">Your guidance pack is included as a dedicated section inside your full report, covering:</p>
      <ul style="font-size: 15px; line-height: 1.9; margin: 0 0 16px; padding-left: 20px;">
        <li>Month-by-month forecast for career, money, love, and health</li>
        <li>Your best months for action — and caution months to be careful</li>
        <li>Key timing windows for important decisions</li>
        <li>A simple practical action plan for each month</li>
        <li>Personal remedies and suggestions</li>
        <li>Your overall theme for the next 12 months</li>
      </ul>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        You'll find it near the end of your full report. You can revisit your report anytime by signing in at
        <a href="https://www.bhavishai.in" style="color: #7c3aed;">bhavishai.in</a> with this email and opening <strong>My Reports</strong>.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        If anything is unclear or you'd like me to look at a specific month, just reply to this email — I read every response personally.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 4px;">— Tushar</p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 0;">Founder, BhavishAI</p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
      <p style="font-size: 11px; color: #9ca3af; text-align: center;">BhavishAI | bhavishai.in</p>
      <img src="${trackingPixel}" width="1" height="1" style="display:none;" alt="" />
    </div>
  `;
}

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId } = await request.json();
    if (!reportId) {
      return NextResponse.json({ error: "Missing reportId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: lead, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, email, has_12_month_guidance")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead.email || !lead.email.trim()) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }
    if (!lead.has_12_month_guidance) {
      return NextResponse.json({ error: "This customer did not buy the 12-Month Guidance add-on" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `Tushar from BhavishAI <${fromEmail}>`,
      to: [lead.email],
      subject: "Your 12-Month Guidance Pack is confirmed 🎉",
      html: buildGuidanceHtml(lead.name, lead.report_id),
      reply_to: process.env.GMAIL_USER || fromEmail,
    });

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message || "Failed to send" }, { status: 500 });
    }

    // Mark as sent — silently skip if column doesn't exist yet
    try {
      await supabase
        .from("reports")
        .update({ guidance_email_sent_at: new Date().toISOString() })
        .eq("report_id", reportId);
    } catch (e) {
      console.warn("guidance_email_sent_at column may not exist yet:", e.message);
    }

    return NextResponse.json({ success: true, email: lead.email, messageId: emailData?.id });
  } catch (error) {
    console.error("send-guidance-email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
