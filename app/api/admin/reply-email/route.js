import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin endpoint: send/reply to any email address from support@bhavishai.in
// POST /api/admin/reply-email
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { to, subject, body, reportId?, inReplyTo? }
//
// If reportId is provided, embeds a tracking pixel so you can see when
// the customer opens the reply (tracked as type="admin_reply" in email_opens).
// Also records the reply metadata (sent_at, subject) on the report row.
export const maxDuration = 15;

function buildReplyHtml(body, reportId) {
  const bodyHtml = (body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="font-size: 15px; line-height: 1.7; margin-bottom: 12px;">${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

  const trackingPixel = reportId
    ? `<img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=admin_reply" width="1" height="1" style="display:none;" alt="" />`
    : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 20px; color: #1a1a2e;">
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px;" />
      <p style="font-size: 11px; color: #9ca3af;">
        BhavishAI Support | <a href="https://www.bhavishai.in" style="color: #8b5cf6;">bhavishai.in</a>
      </p>
    </div>
    ${trackingPixel}
  `;
}

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { to, subject, body, reportId, inReplyTo } = await request.json();

    if (!to || !to.trim()) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 });
    }
    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: "Missing subject" }, { status: 400 });
    }
    if (!body || !body.trim()) {
      return NextResponse.json({ error: "Missing email body" }, { status: 400 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "support@bhavishai.in";

    const emailPayload = {
      from: `BhavishAI Support <${fromEmail}>`,
      to: [to.trim()],
      subject: subject.trim(),
      html: buildReplyHtml(body, reportId),
      reply_to: fromEmail,
    };

    // If replying to a specific email, add threading headers
    if (inReplyTo) {
      emailPayload.headers = {
        "In-Reply-To": inReplyTo,
        "References": inReplyTo,
      };
    }

    const { data, error } = await resend.emails.send(emailPayload);

    if (error) {
      return NextResponse.json({ error: error.message || "Failed to send" }, { status: 500 });
    }

    // If reportId provided, record the reply on the report for tracking
    if (reportId) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );
        await supabase
          .from("reports")
          .update({ admin_reply_sent_at: new Date().toISOString() })
          .eq("report_id", reportId);
      } catch (e) {
        // Non-critical — column might not exist yet, don't fail the response
        console.warn("Could not update admin_reply_sent_at:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      to: to.trim(),
      subject: subject.trim(),
      messageId: data?.id,
    });
  } catch (error) {
    console.error("reply-email error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
