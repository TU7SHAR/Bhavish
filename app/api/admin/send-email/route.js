import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin endpoint: send email to a SINGLE lead.
// POST /api/admin/send-email
// Body: { reportId, mode: "scheduled" | "force" | "custom", customSubject?, customBody? }
export const maxDuration = 30;

const EMAIL_SCHEDULE_HOURS = [12, 24, 72, 120, 168, 240, 336, 504, 720, 1080];
const TOTAL_EMAILS = EMAIL_SCHEDULE_HOURS.length;

function buildHtml(lead, draft, emailNum) {
  const firstName = (lead.name || "there").split(" ")[0];
  const reportUrl = `https://www.bhavishai.in/get-report`;
  const trackingPixel = `https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(lead.report_id)}&en=${emailNum}`;
  const bodyHtml = (draft.body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="font-size: 15px; line-height: 1.7;">${p.replace(/</g, "&lt;")}</p>`)
    .join("");

  return `
    <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 30px 20px; color: #333;">
      <p style="font-size: 15px; line-height: 1.7;">Hi ${firstName},</p>
      ${bodyHtml}
      <p style="margin-top: 25px;">
        <a href="${reportUrl}" style="background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-size: 14px;">
          View My Report &rarr;
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin-top: 30px;">
        BhavishAI | bhavishai.in<br>
        <a href="https://www.bhavishai.in/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
      <img src="${trackingPixel}" width="1" height="1" style="display:none;" alt="" />
    </div>
  `;
}

function buildCustomHtml(lead, subject, body) {
  const firstName = (lead.name || "there").split(" ")[0];
  const reportUrl = `https://www.bhavishai.in/get-report`;
  const bodyHtml = (body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="font-size: 15px; line-height: 1.7;">${p.replace(/</g, "&lt;")}</p>`)
    .join("");

  return `
    <div style="font-family: Georgia, serif; max-width: 500px; margin: 0 auto; padding: 30px 20px; color: #333;">
      <p style="font-size: 15px; line-height: 1.7;">Hi ${firstName},</p>
      ${bodyHtml}
      <p style="margin-top: 25px;">
        <a href="${reportUrl}" style="background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 25px; text-decoration: none; font-size: 14px;">
          View My Report &rarr;
        </a>
      </p>
      <p style="color: #9ca3af; font-size: 11px; margin-top: 30px;">
        BhavishAI | bhavishai.in<br>
        <a href="https://www.bhavishai.in/unsubscribe?email=${encodeURIComponent(lead.email)}" style="color: #9ca3af;">Unsubscribe</a>
      </p>
    </div>
  `;
}

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison for admin auth
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId, mode, customSubject, customBody } = await request.json();

    if (!reportId || !mode) {
      return NextResponse.json({ error: "Missing reportId or mode" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Fetch lead
    const { data: lead, error: fetchError } = await supabase
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .single();

    if (fetchError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    if (!lead.email || !lead.email.trim()) {
      return NextResponse.json({ error: "Lead has no email address" }, { status: 400 });
    }

    const now = new Date();

    // MODE: CUSTOM — send a custom email (no sequence tracking)
    if (mode === "custom") {
      if (!customSubject || !customBody) {
        return NextResponse.json({ error: "Custom mode requires customSubject and customBody" }, { status: 400 });
      }

      const { data, error } = await resend.emails.send({
        from: `BhavishAI <${fromEmail}>`,
        to: [lead.email],
        subject: customSubject,
        html: buildCustomHtml(lead, customSubject, customBody),
        reply_to: process.env.GMAIL_USER || fromEmail,
      });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, mode: "custom", email: lead.email, subject: customSubject, messageId: data?.id });
    }

    // MODE: SCHEDULED or FORCE — send next in sequence
    const drafts = Array.isArray(lead.email_drafts) ? lead.email_drafts : [];
    const emailsSent = lead.emails_sent_count || 0;

    if (drafts.length === 0) {
      return NextResponse.json({ error: "No email drafts generated for this lead. Run backfill first." }, { status: 400 });
    }

    if (emailsSent >= TOTAL_EMAILS || emailsSent >= drafts.length) {
      return NextResponse.json({ error: "Sequence already completed for this lead." }, { status: 400 });
    }

    // In scheduled mode, check if due
    if (mode === "scheduled") {
      const dueAfterHours = EMAIL_SCHEDULE_HOURS[emailsSent];
      const hoursSinceCreation = (now - new Date(lead.created_at)) / 3.6e6;
      if (hoursSinceCreation < dueAfterHours) {
        return NextResponse.json({
          error: `Next email (#${emailsSent + 1}) not due yet. Due after ${dueAfterHours}h, currently ${Math.round(hoursSinceCreation)}h since sign-up.`,
        }, { status: 400 });
      }
    }

    const draft = drafts[emailsSent];
    if (!draft || !draft.body) {
      return NextResponse.json({ error: `Draft #${emailsSent + 1} is empty/invalid.` }, { status: 400 });
    }

    const subject = (draft.subject || "Your BhavishAI report").toString();
    const emailNum = emailsSent + 1;

    const { data, error } = await resend.emails.send({
      from: `BhavishAI <${fromEmail}>`,
      to: [lead.email],
      subject,
      html: buildHtml(lead, draft, emailNum),
      reply_to: process.env.GMAIL_USER || fromEmail,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update DB
    const newCount = emailsSent + 1;
    await supabase
      .from("reports")
      .update({
        emails_sent_count: newCount,
        last_email_sent_at: now.toISOString(),
        email_sequence_status: newCount >= TOTAL_EMAILS ? "completed" : "active",
      })
      .eq("report_id", reportId);

    return NextResponse.json({
      success: true,
      mode,
      email: lead.email,
      emailNum,
      subject,
      messageId: data?.id,
    });
  } catch (error) {
    console.error("Admin send-email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
