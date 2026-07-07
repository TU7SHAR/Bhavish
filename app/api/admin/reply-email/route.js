import { Resend } from "resend";
import { NextResponse } from "next/server";

// Admin endpoint: send/reply to any email address from support@bhavishai.in
// POST /api/admin/reply-email
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: { to, subject, body, inReplyTo? }
//
// Use cases:
//   - Reply to an inbound email from a customer (e.g. from Resend inbound)
//   - Send a one-off email to any address from support@bhavishai.in
export const maxDuration = 15;

function buildReplyHtml(body) {
  const bodyHtml = (body || "")
    .split(/\n+/)
    .filter(Boolean)
    .map((p) => `<p style="font-size: 15px; line-height: 1.7; margin-bottom: 12px;">${p.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px 20px; color: #1a1a2e;">
      ${bodyHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0 12px;" />
      <p style="font-size: 11px; color: #9ca3af;">
        BhavishAI Support | <a href="https://www.bhavishai.in" style="color: #8b5cf6;">bhavishai.in</a>
      </p>
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
    const { to, subject, body, inReplyTo } = await request.json();

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
      html: buildReplyHtml(body),
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
