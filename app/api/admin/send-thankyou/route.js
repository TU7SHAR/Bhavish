import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin endpoint: send a personal thank-you email from the founder to a paid user.
// POST /api/admin/send-thankyou
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId }
export const maxDuration = 30;

function buildThankYouHtml(name, reportId) {
  const firstName = (name || "there").split(" ")[0];
  const trackingPixel = `https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=thankyou`;

  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
      <p style="font-size: 16px; line-height: 1.8; margin-bottom: 16px;">Hi ${firstName},</p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        I wanted to personally thank you for trusting BhavishAI with your birth chart analysis. It means a lot to me that you chose us over the dozens of options out there.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        I built this with a simple belief: everyone deserves access to accurate, personalized Vedic astrology — without paying thousands or waiting days.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        If your report resonated with you, or if there's anything you'd like me to improve, just reply to this email. I read every single response personally.
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 16px;">
        Wishing you clarity and good timing ahead. 🙏
      </p>

      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 4px;">
        — Tushar
      </p>
      <p style="font-size: 13px; color: #6b7280; margin-top: 0;">
        Founder, BhavishAI
      </p>

      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0 16px;" />
      <p style="font-size: 11px; color: #9ca3af; text-align: center;">
        BhavishAI | bhavishai.in
      </p>
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

    // Fetch the lead
    const { data: lead, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, email, payment_status, thankyou_sent_at")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email || !lead.email.trim()) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    if (lead.payment_status !== "paid") {
      return NextResponse.json({ error: "Can only send thank you to paid customers" }, { status: 400 });
    }

    // Send via Resend
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `Tushar from BhavishAI <${fromEmail}>`,
      to: [lead.email],
      subject: `Thank you, ${(lead.name || "").split(" ")[0]} 🙏`,
      html: buildThankYouHtml(lead.name, lead.report_id),
      reply_to: process.env.GMAIL_USER || fromEmail,
    });

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message || "Failed to send" }, { status: 500 });
    }

    // Mark as sent — try with new column, silently skip if column doesn't exist
    try {
      await supabase
        .from("reports")
        .update({ thankyou_sent_at: new Date().toISOString() })
        .eq("report_id", reportId);
    } catch (e) {
      console.warn("thankyou_sent_at column may not exist yet:", e.message);
    }

    return NextResponse.json({
      success: true,
      email: lead.email,
      messageId: emailData?.id,
    });
  } catch (error) {
    console.error("send-thankyou error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
