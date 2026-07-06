import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Admin endpoint: send the "How to use BhavishAI" guide email. MANUAL only —
// the owner sends this from the super admin. Never auto-sent.
// POST /api/admin/send-howto-email
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { reportId }
export const maxDuration = 30;

function buildHowToHtml(name, email, reportId) {
  const firstName = (name || "there").split(" ")[0];
  const trackingPixel = `https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=howto`;

  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; color: #1a1a2e;">
      <h2 style="color: #7c3aed; font-size: 20px; margin-bottom: 8px;">How to use BhavishAI</h2>
      <p style="font-size: 15px; line-height: 1.8; margin-bottom: 20px;">Hi ${firstName}, here's a quick guide so you get the most out of BhavishAI.</p>

      <h3 style="font-size: 15px; color: #1a1a2e; margin: 20px 0 6px;">🔮 Generating a report</h3>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 4px; color: #374151;">
        Go to <a href="https://www.bhavishai.in/get-report" style="color:#7c3aed;">bhavishai.in</a>, enter your exact birth date, time, and place, and ask your one most important question. You'll see a free preview, then unlock the full 20-page personalized report.
      </p>

      <h3 style="font-size: 15px; color: #1a1a2e; margin: 20px 0 6px;">📅 Your 12-Month Guidance Pack</h3>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 4px; color: #374151;">
        If you purchased the ₹149 add-on, your month-by-month guidance is included as a dedicated section near the end of your full report — best months, caution periods, timing windows, and a monthly action plan.
      </p>

      <h3 style="font-size: 15px; color: #1a1a2e; margin: 20px 0 6px;">🎖️ Founder Access</h3>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 4px; color: #374151;">
        Founder members can generate up to 5 personalized reports every month for 2 years — for yourself or close family. Just sign in and use "Generate New Report" from your dashboard.
      </p>

      <h3 style="font-size: 15px; color: #1a1a2e; margin: 20px 0 6px;">📂 Accessing your reports anytime</h3>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 4px; color: #374151;">
        1. Go to <a href="https://www.bhavishai.in" style="color:#7c3aed;">bhavishai.in</a><br/>
        2. Click <strong>Sign in with Google</strong> using <strong>${email || "this email address"}</strong><br/>
        3. Open <strong>My Reports</strong> — all your reports will be there.
      </p>
      <p style="font-size: 13px; line-height: 1.6; color: #6b7280; margin: 8px 0 16px;">
        Tip: sign in with the same email this message was sent to, so your reports are linked to your account.
      </p>

      <p style="font-size: 14px; line-height: 1.7; margin-bottom: 16px; color: #374151;">
        Any questions? Just reply to this email — I read every message personally.
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
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      .select("report_id, name, email")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }
    if (!lead.email || !lead.email.trim()) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const { data: emailData, error: emailErr } = await resend.emails.send({
      from: `Tushar from BhavishAI <${fromEmail}>`,
      to: [lead.email],
      subject: "How to use BhavishAI — your quick guide",
      html: buildHowToHtml(lead.name, lead.email, lead.report_id),
      reply_to: process.env.GMAIL_USER || fromEmail,
    });

    if (emailErr) {
      return NextResponse.json({ error: emailErr.message || "Failed to send" }, { status: 500 });
    }

    try {
      await supabase
        .from("reports")
        .update({ howto_sent_at: new Date().toISOString() })
        .eq("report_id", reportId);
    } catch (e) {
      console.warn("howto_sent_at column may not exist yet:", e.message);
    }

    return NextResponse.json({ success: true, email: lead.email, messageId: emailData?.id });
  } catch (error) {
    console.error("send-howto-email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
