import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { selectRecipients } from "../../../../lib/broadcast-filters.js";
import { logEvent, logError } from "../../../../lib/ops-log.js";

// Admin: send a broadcast email to filtered, de-duplicated recipients.
//
// DESIGN (deliberate, for the free tier + safety):
//  - Filtering + de-dup happens in OUR DB (unlimited), not Resend audiences
//    (which are capped at 1,000 contacts on the free plan).
//  - We send via the normal Resend emails.send API, ONE personalised email per
//    person, gently paced to respect Resend's ~2 req/sec rate limit.
//  - HARD SAFETY CAP: at most MAX_PER_SEND emails per invocation. Resend free
//    tier allows 100 transactional emails/day and report delivery shares that
//    budget. Capping protects paid-report emails from being starved by a blast.
//    Bigger lists must be sent over multiple days (or after upgrading Resend).
//  - Every email carries an unsubscribe link. Unsubscribed users are already
//    excluded by selectRecipients().
//
// POST /api/admin/broadcast-send
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { subject, body, filters?, confirm: true }
export const maxDuration = 60;

// Keep well under the 100/day transactional cap so report delivery always has
// headroom. Tune via env if you upgrade Resend.
const MAX_PER_SEND = parseInt(process.env.BROADCAST_MAX_PER_SEND || "80", 10);
const SEND_DELAY_MS = 600; // ~1.6/sec, safely under Resend's 2/sec
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildHtml({ name, bodyText, email }) {
  const firstName = (name || "there").split(" ")[0];
  const paras = (bodyText || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    // Escape HTML, then restore single newlines as <br>.
    .map((p) => `<p style="font-size:15px;line-height:1.7;color:#333;">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
    .join("");

  return `
    <div style="font-family: Georgia, serif; max-width: 520px; margin: 0 auto; padding: 30px 20px; color: #333;">
      <p style="font-size:15px;line-height:1.7;">Hi ${firstName.replace(/</g, "&lt;")},</p>
      ${paras}
      <p style="margin-top:26px;">
        <a href="https://www.bhavishai.in/get-report" style="background:#8b5cf6;color:#fff;padding:12px 24px;border-radius:25px;text-decoration:none;font-size:14px;">
          Get Your Report &rarr;
        </a>
      </p>
      <p style="color:#9ca3af;font-size:11px;margin-top:32px;border-top:1px solid #eee;padding-top:14px;">
        BhavishAI | bhavishai.in<br>
        <a href="https://www.bhavishai.in/unsubscribe?email=${encodeURIComponent(email)}" style="color:#9ca3af;">Unsubscribe</a>
      </p>
    </div>
  `;
}

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { subject, body: emailBody, filters = {}, confirm } = body || {};

  if (!subject || !subject.trim()) return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  if (!emailBody || !emailBody.trim()) return NextResponse.json({ error: "Email body is required." }, { status: 400 });
  if (confirm !== true) return NextResponse.json({ error: "confirm:true is required to actually send." }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY not configured." }, { status: 500 });
  }

  try {
    const { recipients, total, error } = await selectRecipients(filters);
    if (error) return NextResponse.json({ ok: false, error }, { status: 200 });
    if (total === 0) return NextResponse.json({ ok: true, sent: 0, message: "No recipients matched the filters." });

    // Enforce the daily-safety cap. If the segment is bigger, send the first
    // MAX_PER_SEND now and tell the admin how many remain (narrow the filter,
    // send again tomorrow, or upgrade Resend).
    const batch = recipients.slice(0, MAX_PER_SEND);
    const deferred = total - batch.length;

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    let sent = 0;
    let failed = 0;
    for (const r of batch) {
      try {
        const { error: sendErr } = await resend.emails.send({
          from: `BhavishAI <${fromEmail}>`,
          to: [r.email],
          subject: subject.trim(),
          html: buildHtml({ name: r.name, bodyText: emailBody, email: r.email }),
          reply_to: process.env.GMAIL_USER || fromEmail,
        });
        if (sendErr) { failed++; } else { sent++; }
      } catch {
        failed++;
      }
      await sleep(SEND_DELAY_MS);
    }

    await logEvent({
      event: "admin.broadcast_sent",
      level: failed > 0 ? "warn" : "info",
      source: "admin-broadcast",
      message: `broadcast "${subject.trim().slice(0, 60)}" → sent ${sent}, failed ${failed}, deferred ${deferred}`,
      meta: { matched: total, sent, failed, deferred, filters },
    });

    return NextResponse.json({
      ok: true,
      matched: total,
      sent,
      failed,
      deferred,
      message:
        deferred > 0
          ? `Sent ${sent} now. ${deferred} more matched but were held back (daily safety cap ${MAX_PER_SEND}). Narrow the filter or send again later.`
          : `Sent ${sent}${failed ? `, ${failed} failed` : ""}.`,
    });
  } catch (e) {
    await logError({ event: "admin.broadcast_failed", source: "admin-broadcast", message: e.message, error: e });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
