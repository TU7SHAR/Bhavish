import { Resend } from "resend";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { email, name, reportId, sections, summary } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Initialize Resend inside the handler (not at module level)
    // so it doesn't crash during build when env vars aren't available
    const resend = new Resend(process.env.RESEND_API_KEY);

    // Build email HTML
    const reportHtml = `
      <!DOCTYPE html>
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
          <p>This report is generated using AI-powered Vedic astrology analysis. For entertainment purposes.</p>
          <p>For major life decisions, consult with qualified professionals.</p>
        </div>
      </body>
      </html>
    `;

    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const { data, error } = await resend.emails.send({
      from: `BhavishAI <${fromEmail}>`,
      to: [email],
      subject: `Your Personalized Vedic Astrology Report - ${name}`,
      html: reportHtml,
    });

    if (error) {
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Failed to send email. Your report is still available on-screen." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: data?.id,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json(
      { error: "Failed to send email." },
      { status: 500 }
    );
  }
}
