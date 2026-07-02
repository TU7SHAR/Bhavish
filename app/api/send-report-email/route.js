import { Resend } from "resend";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

// Build the email HTML template
function buildReportHtml({ name, reportId, summary, sections }) {
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
  <p>Thank you for choosing BhavishAI. Here is your complete personalized Vedic astrology report.</p>
  <p><strong>Report ID:</strong> ${reportId}</p>
  <p><em>${summary}</em></p>
  
  ${sections
    .map(
      (s, i) => `
    <div class="section">
      <h2>${i + 1}. ${s.title}</h2>
      <p>${s.content.replace(/\n/g, "<br>")}</p>
    </div>
  `
    )
    .join("")}
  
  <div class="footer">
    <p>&copy; ${new Date().getFullYear()} BhavishAI | bhavishai.in</p>
    <p>This report is generated using AI-powered Vedic astrology analysis based on Swiss Ephemeris calculations.</p>
    <p>For major life decisions, consult with qualified professionals.</p>
  </div>
  <img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=report" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
}

// Send via Resend (primary)
async function sendWithResend({ email, name, reportId, html }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { data, error } = await resend.emails.send({
    from: `BhavishAI <${fromEmail}>`,
    to: [email],
    subject: `Your Personalized Vedic Astrology Report - ${name}`,
    html,
    reply_to: process.env.GMAIL_USER || fromEmail,
  });

  if (error) throw new Error(error.message || "Resend failed");
  return { provider: "resend", messageId: data?.id };
}

// Send via Gmail SMTP (fallback)
async function sendWithGmail({ email, name, html }) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  const info = await transporter.sendMail({
    from: `BhavishAI <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `Your Personalized Vedic Astrology Report - ${name}`,
    html,
  });

  return { provider: "gmail", messageId: info.messageId };
}

export async function POST(request) {
  try {
    const { email, name, reportId, sections, summary } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const html = buildReportHtml({ name, reportId, summary, sections });

    // Try Resend first, fall back to Gmail
    let result;
    try {
      result = await sendWithResend({ email, name, reportId, html });
      console.log("Email sent via Resend:", result.messageId);
    } catch (resendError) {
      console.warn("Resend failed, trying Gmail fallback:", resendError.message);

      // Check if Gmail credentials are configured
      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error("Gmail fallback not configured");
        return NextResponse.json(
          { error: "Email delivery failed. Your report is still available on-screen and can be downloaded." },
          { status: 500 }
        );
      }

      try {
        result = await sendWithGmail({ email, name, html });
        console.log("Email sent via Gmail fallback:", result.messageId);
      } catch (gmailError) {
        console.error("Gmail fallback also failed:", gmailError.message);
        return NextResponse.json(
          { error: "Email delivery failed. Your report is still available on-screen and can be downloaded." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      messageId: result.messageId,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send email." },
      { status: 500 }
    );
  }
}
