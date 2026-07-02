import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// OPTION B: This cron does NOT call Gemini. The 10 nurture emails are
// pre-generated (one Gemini call) when the user creates their preview and
// stored in reports.email_drafts (JSONB). Here we just pick the next due
// email and SEND it — fast enough to fit Vercel's function timeout.

// When each email goes out (hours after the lead was created).
// Index i => email number i+1. Must stay aligned with EMAIL_PLAN order
// in /api/generate-email-sequence.
const EMAIL_SCHEDULE_HOURS = [
  12,   // 1 - unfinished_task (12h)
  24,   // 2 - curiosity_gap (1d)
  72,   // 3 - authority (3d)
  120,  // 4 - personal_identity (5d)
  168,  // 5 - future_self (7d)
  240,  // 6 - social_proof (10d)
  336,  // 7 - loss_aversion (14d)
  504,  // 8 - hope (21d)
  720,  // 9 - commitment (30d)
  1080, // 10 - discount (45d)
];

const TOTAL_EMAILS = EMAIL_SCHEDULE_HOURS.length;

// Stop sending before the function times out. Free tier kills at ~10s,
// Pro respects maxDuration (60s). Leftover due emails are picked up on the
// next cron run, so nothing is lost — it just spreads across runs.
const TIME_BUDGET_MS = 9000;
const COOLDOWN_HOURS = 6; // never send two emails to the same lead within 6h

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
  const startTime = Date.now();

  // Optional cron secret protection
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Email senders: Resend (primary) + Gmail (fallback)
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    async function sendEmail({ to, subject, html }) {
      // Try Resend first
      try {
        const { data, error } = await resend.emails.send({
          from: `BhavishAI <${fromEmail}>`,
          to: [to],
          subject,
          html,
          reply_to: process.env.GMAIL_USER || fromEmail,
        });
        if (error) throw new Error(error.message || "Resend failed");
        return { provider: "resend", messageId: data?.id };
      } catch (resendError) {
        // Fall back to Gmail
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          throw resendError;
        }
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });
        const info = await transporter.sendMail({
          from: `BhavishAI <${process.env.GMAIL_USER}>`,
          to,
          subject,
          html,
        });
        return { provider: "gmail", messageId: info.messageId };
      }
    }

    // Pull unpaid leads with an email and pre-generated drafts that haven't
    // finished the sequence. Oldest first so no lead gets starved.
    const { data: leads, error: fetchError } = await supabase
      .from("reports")
      .select("report_id, name, email, created_at, emails_sent_count, last_email_sent_at, email_sequence_status, email_drafts")
      .eq("payment_status", "unpaid")
      .not("email", "is", null)
      .neq("email", "")
      .not("email_drafts", "is", null)
      .or("email_sequence_status.is.null,email_sequence_status.neq.completed")
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Failed to fetch leads:", fetchError);
      return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({ message: "No leads to process", sent: 0 });
    }

    const now = new Date();
    let totalSent = 0;
    let skippedForTime = 0;
    const results = [];

    for (const lead of leads) {
      // Time guard — stop before the function is killed; rest waits for next run.
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        skippedForTime = leads.length - leads.indexOf(lead);
        break;
      }

      try {
        const drafts = Array.isArray(lead.email_drafts) ? lead.email_drafts : [];
        if (drafts.length === 0) continue;

        const emailsSent = lead.emails_sent_count || 0;

        // Whole sequence done (or we have no more drafts) -> mark complete.
        if (emailsSent >= TOTAL_EMAILS || emailsSent >= drafts.length) {
          await supabase
            .from("reports")
            .update({ email_sequence_status: "completed" })
            .eq("report_id", lead.report_id);
          continue;
        }

        // Is the next email due yet?
        const dueAfterHours = EMAIL_SCHEDULE_HOURS[emailsSent];
        const hoursSinceCreation = (now - new Date(lead.created_at)) / 3.6e6;
        if (hoursSinceCreation < dueAfterHours) continue;

        // Cooldown so a backlog doesn't fire several emails at once.
        if (lead.last_email_sent_at) {
          const hoursSinceLast = (now - new Date(lead.last_email_sent_at)) / 3.6e6;
          if (hoursSinceLast < COOLDOWN_HOURS) continue;
        }

        const draft = drafts[emailsSent];
        if (!draft || !draft.body) {
          // Bad/empty draft — skip this slot but advance the counter so the
          // sequence doesn't get permanently stuck on it.
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

        await sendEmail({
          to: lead.email,
          subject,
          html: buildHtml(lead, draft, emailsSent + 1),
        });

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
        results.push({ email: lead.email, emailNum: newCount, subject });

        // Respect Resend rate limit (2 req/sec)
        await delay(SEND_DELAY_MS);
      } catch (leadError) {
        console.error(`Error processing lead ${lead.email}:`, leadError.message);
        continue;
      }
    }

    // Owner summary email (only when something actually went out).
    if (totalSent > 0 && process.env.GMAIL_USER) {
      try {
        await sendEmail({
          to: process.env.GMAIL_USER,
          subject: `Nurture cron: sent ${totalSent} email(s)`,
          html: `<p>Sent ${totalSent}. Deferred to next run: ${skippedForTime}.</p><pre>${JSON.stringify(results, null, 2)}</pre>`,
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      processed: leads.length,
      sent: totalSent,
      deferredToNextRun: skippedForTime,
      results,
    });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
