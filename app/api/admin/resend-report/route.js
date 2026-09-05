import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { mdToHtml } from "../../../../lib/markdown.js";
import { ensureAccessToken, reportViewUrl } from "../../../../lib/report-access.js";

// Admin endpoint: re-send the full report email to a paid customer.
// POST /api/admin/resend-report
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId }
export const maxDuration = 30;

function buildReportHtml({ name, reportId, summary, sections, viewUrl, email }) {
  const linkBlock = viewUrl
    ? `<div style="margin: 20px 0; padding: 18px; background: #f5f0ff; border: 1px solid #ddd6fe; border-radius: 10px; text-align: center;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #4c1d95;">Access your report anytime — no login needed:</p>
        <a href="${viewUrl}" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 12px 28px; border-radius: 25px; text-decoration: none; font-size: 14px; font-weight: 600;">View My Report Online</a>
        <p style="margin: 12px 0 0; font-size: 11px; color: #6b7280;">Bookmark this link to return to your report whenever you like.</p>
      </div>`
    : `<div style="margin: 20px 0; padding: 18px; background: #f5f0ff; border: 1px solid #ddd6fe; border-radius: 10px; text-align: center;">
        <p style="margin: 0 0 12px; font-size: 14px; color: #4c1d95;">Access your full report anytime:</p>
        <a href="https://www.bhavishai.in/report/full" style="display: inline-block; background: #7c3aed; color: #ffffff; padding: 12px 28px; border-radius: 25px; text-decoration: none; font-size: 14px; font-weight: 600;">View My Report Online</a>
        <p style="margin: 12px 0 0; font-size: 11px; color: #6b7280;">Sign in with your Google account${email ? ` (${email})` : ""} to access your report.</p>
      </div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Georgia', serif; line-height: 1.8; color: #333; max-width: 700px; margin: 0 auto; padding: 20px; }
    h1 { color: #7c3aed; text-align: center; }
    h2 { color: #8b5cf6; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-top: 30px; }
    .header { text-align: center; padding: 30px; background: linear-gradient(135deg, #1a1a2e, #0a0a0f); color: white; border-radius: 12px; margin-bottom: 30px; }
    .header h1 { color: #a78bfa; margin: 0; }
    .section { margin: 20px 0; padding: 20px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #8b5cf6; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; margin-top: 40px; border-top: 1px solid #e5e7eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>✨ BhavishAI</h1>
    <p style="color: #d1d5db; margin-top: 8px;">Your Complete Vedic Astrology Report</p>
  </div>
  
  <p>Dear <strong>${name}</strong>,</p>
  <p>Here is your complete personalized Vedic astrology report (re-sent upon request).</p>
  <p><strong>Report ID:</strong> ${reportId}</p>
  ${linkBlock}
  <p><em>${summary || ""}</em></p>
  
  ${(sections || [])
    .map(
      (s, i) => `
    <div class="section">
      <h2>${i + 1}. ${(s.title || "").replace(/^\d+\.\s*/, "")}</h2>
      <p>${mdToHtml(s.content || "")}</p>
    </div>
  `
    )
    .join("")}
  
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} BhavishAI | bhavishai.in</p>
    <p>This report was generated using AI-powered Vedic astrology analysis based on high-precision astronomical calculations.</p>
  </div>
  <img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=report" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
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

    // Fetch the full report
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, email, summary, sections, payment_status")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    if (!report.email || !report.email.trim()) {
      return NextResponse.json({ error: "No email address for this report" }, { status: 400 });
    }

    if (report.payment_status !== "paid") {
      return NextResponse.json({ error: "Can only resend report to paid customers" }, { status: 400 });
    }

    if (!report.sections || !Array.isArray(report.sections) || report.sections.length === 0) {
      return NextResponse.json({ error: "Report has no sections to send" }, { status: 400 });
    }

    const html = buildReportHtml({
      name: report.name,
      reportId: report.report_id,
      summary: report.summary,
      sections: report.sections,
      viewUrl: await (async () => {
        const token = await ensureAccessToken(supabase, report.report_id);
        return token ? reportViewUrl(token) : null;
      })(),
      email: report.email,
    });

    // Try Resend first, fallback to Gmail
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    let result;
    try {
      const { data, error } = await resend.emails.send({
        from: `BhavishAI <${fromEmail}>`,
        to: [report.email],
        subject: `Your Vedic Astrology Report (Re-sent) - ${report.name}`,
        html,
        reply_to: process.env.GMAIL_USER || fromEmail,
      });
      if (error) throw new Error(error.message);
      result = { provider: "resend", messageId: data?.id };
    } catch (resendErr) {
      // Fallback to Gmail
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return NextResponse.json({ error: "Email delivery failed: " + resendErr.message }, { status: 500 });
      }
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      });
      const info = await transporter.sendMail({
        from: `BhavishAI <${process.env.GMAIL_USER}>`,
        to: report.email,
        subject: `Your Vedic Astrology Report (Re-sent) - ${report.name}`,
        html,
      });
      result = { provider: "gmail", messageId: info.messageId };
    }

    return NextResponse.json({
      success: true,
      email: report.email,
      ...result,
    });
  } catch (error) {
    console.error("resend-report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
