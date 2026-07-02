import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// Manual email send endpoint — NO time budget, NO cron involvement.
// Sends ALL due nurture emails in one go via Resend.
// 
// GET /api/manual-send-emails
// Header: Authorization: Bearer <CRON_SECRET>
//
// Optional query params:
//   ?force=true      → ignore schedule, send next email for ALL leads
//   ?email=x@y.com   → send only to this specific lead
export const maxDuration = 60;

const EMAIL_SCHEDULE_HOURS = [
  12, 24, 72, 120, 168, 240, 336, 504, 720, 1080,
];
const TOTAL_EMAILS = EMAIL_SCHEDULE_HOURS.length;

// Resend free tier: 2 requests/second. 600ms gap keeps us safely under.
const SEND_DELAY_MS = 600;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function buildHtml(lead, draft, emailNum) {
  const firstName = (lead.name || "there").split(" ")[0];
  const reportUrl = `https://www.bhavishai.in/get-report`;
  const trackingPixel = `https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(lead.report_id)}&en=${emailNum}`;
  const bodyHtml = (draft.body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="font-size: 15px; line-height: 1.7;">${p.replace(/</g, "&lt;")}</p>`
    )
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

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forceMode = searchParams.get("force") === "true";
  const freshOnly = searchParams.get("fresh") === "true";
  const filterEmail = searchParams.get("email");

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Build query
    let query = supabase
      .from("reports")
      .select("report_id, name, email, created_at, emails_sent_count, last_email_sent_at, email_sequence_status, email_drafts")
      .eq("payment_status", "unpaid")
      .not("email", "is", null)
      .neq("email", "")
      .not("email_drafts", "is", null)
      .or("email_sequence_status.is.null,email_sequence_status.neq.completed")
      .order("created_at", { ascending: true });

    if (filterEmail) {
      query = query.eq("email", filterEmail);
    }

    // Fresh mode: ONLY leads who haven't received any email yet
    if (freshOnly) {
      query = query.or("emails_sent_count.is.null,emails_sent_count.eq.0");
    }

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json({ error: "DB fetch failed", details: fetchError.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: "No leads to process", sent: 0 });
    }

    const now = new Date();
    let totalSent = 0;
    const results = [];
    const errors = [];

    for (const lead of leads) {
      try {
        const drafts = Array.isArray(lead.email_drafts) ? lead.email_drafts : [];
        if (drafts.length === 0) continue;

        const emailsSent = lead.emails_sent_count || 0;

        if (emailsSent >= TOTAL_EMAILS || emailsSent >= drafts.length) {
          await supabase
            .from("reports")
            .update({ email_sequence_status: "completed" })
            .eq("report_id", lead.report_id);
          continue;
        }

        // In normal mode, check schedule. In force mode, skip schedule check.
        if (!forceMode) {
          const dueAfterHours = EMAIL_SCHEDULE_HOURS[emailsSent];
          const hoursSinceCreation = (now - new Date(lead.created_at)) / 3.6e6;
          if (hoursSinceCreation < dueAfterHours) continue;
        }

        const draft = drafts[emailsSent];
        if (!draft || !draft.body) {
          await supabase
            .from("reports")
            .update({
              emails_sent_count: emailsSent + 1,
              last_email_sent_at: now.toISOString(),
            })
            .eq("report_id", lead.report_id);
          continue;
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

        if (error) {
          errors.push({ email: lead.email, emailNum, error: error.message });
          await delay(SEND_DELAY_MS);
          continue;
        }

        const newCount = emailsSent + 1;
        await supabase
          .from("reports")
          .update({
            emails_sent_count: newCount,
            last_email_sent_at: now.toISOString(),
            email_sequence_status: newCount >= TOTAL_EMAILS ? "completed" : "active",
          })
          .eq("report_id", lead.report_id);

        totalSent++;
        results.push({ email: lead.email, emailNum, subject, messageId: data?.id });

        // Respect Resend rate limit (2 req/sec)
        await delay(SEND_DELAY_MS);
      } catch (leadError) {
        errors.push({ email: lead.email, error: leadError.message });
      }
    }

    return NextResponse.json({
      success: true,
      mode: freshOnly ? "fresh" : forceMode ? "force" : "scheduled",
      processed: leads.length,
      sent: totalSent,
      errors,
      results,
    });
  } catch (error) {
    console.error("Manual send error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
