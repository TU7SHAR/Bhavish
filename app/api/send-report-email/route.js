import { Resend } from "resend";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export const maxDuration = 30;

// Lucky factors lookup by ascendant sign index
const SIGN_GEMS = {
  1: { gem: "Red Coral", lucky: "9, 1, 3", day: "Tuesday", color: "Red" },
  2: { gem: "Diamond", lucky: "6, 2, 7", day: "Friday", color: "White" },
  3: { gem: "Emerald", lucky: "5, 3, 8", day: "Wednesday", color: "Green" },
  4: { gem: "Pearl", lucky: "2, 7, 9", day: "Monday", color: "White/Silver" },
  5: { gem: "Ruby", lucky: "1, 4, 9", day: "Sunday", color: "Gold/Orange" },
  6: { gem: "Emerald", lucky: "5, 3, 6", day: "Wednesday", color: "Green" },
  7: { gem: "Diamond", lucky: "6, 7, 2", day: "Friday", color: "White/Pink" },
  8: { gem: "Red Coral", lucky: "9, 1, 8", day: "Tuesday", color: "Dark Red" },
  9: { gem: "Yellow Sapphire", lucky: "3, 9, 5", day: "Thursday", color: "Yellow" },
  10: { gem: "Blue Sapphire", lucky: "8, 4, 6", day: "Saturday", color: "Blue/Black" },
  11: { gem: "Blue Sapphire", lucky: "8, 4, 7", day: "Saturday", color: "Blue" },
  12: { gem: "Yellow Sapphire", lucky: "3, 9, 7", day: "Thursday", color: "Yellow" },
};

function buildReportHtml({ name, reportId, summary, sections, chartData }) {
  const planetOrder = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];

  // Build planet table rows
  let planetTableHtml = "";
  if (chartData && chartData.planets) {
    const rows = planetOrder
      .filter((p) => chartData.planets[p])
      .map((p) => {
        const d = chartData.planets[p];
        return `<tr>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${p}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.sign || ""}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.degree || ""}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${d.house || ""}</td>
          <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-size: 11px;">${d.dignity || "Normal"}</td>
        </tr>`;
      })
      .join("");

    planetTableHtml = `
      <div style="margin: 30px 0; padding: 20px; background: #f0f0ff; border-radius: 8px;">
        <h2 style="color: #8b5cf6; margin-top: 0;">Planetary Positions (Swiss Ephemeris)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #e5e7eb;">
              <th style="padding: 8px; text-align: left;">Planet</th>
              <th style="padding: 8px; text-align: left;">Sign</th>
              <th style="padding: 8px; text-align: left;">Degree</th>
              <th style="padding: 8px; text-align: left;">House</th>
              <th style="padding: 8px; text-align: left;">Dignity</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background: #fef3c7;">
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 700; color: #d97706;">Lagna (ASC)</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${chartData.ascendant?.sign || ""}</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${chartData.ascendant?.degree || ""}</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">1st</td>
              <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">—</td>
            </tr>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  // Nakshatra info
  let nakshatraHtml = "";
  if (chartData && chartData.nakshatra) {
    nakshatraHtml = `
      <div style="margin: 20px 0; padding: 16px; background: #f5f0ff; border-radius: 8px; border-left: 4px solid #8b5cf6;">
        <strong style="color: #7c3aed;">Birth Star:</strong> ${chartData.nakshatra.name} (Pada ${chartData.nakshatra.pada})<br>
        <strong>Ruler:</strong> ${chartData.nakshatra.ruler} | <strong>Deity:</strong> ${chartData.nakshatra.deity || "—"}<br>
        <strong>Rashi (Moon Sign):</strong> ${chartData.rashi || "—"}
      </div>
    `;
  }

  // Lucky factors
  let luckyHtml = "";
  if (chartData && chartData.ascendant) {
    const lucky = SIGN_GEMS[chartData.ascendant.signIndex || 1] || SIGN_GEMS[1];
    luckyHtml = `
      <div style="margin: 20px 0; padding: 16px; background: #f0fdf4; border-radius: 8px; border-left: 4px solid #10b981;">
        <h3 style="color: #059669; margin-top: 0;">Lucky Factors</h3>
        <table style="font-size: 14px;">
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Gemstone:</td><td>${lucky.gem}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Color:</td><td>${lucky.color}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Numbers:</td><td>${lucky.lucky}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; font-weight: 600;">Day:</td><td>${lucky.day}</td></tr>
        </table>
      </div>
    `;
  }

  // Dasha sequence
  let dashaHtml = "";
  if (chartData && chartData.dasha && chartData.dasha.length > 0) {
    const dashaRows = chartData.dasha
      .map((d, i) => `<tr><td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6;">${i === 0 ? "▶ " : ""}${d.planet}</td><td style="padding: 4px 8px; border-bottom: 1px solid #f3f4f6;">${d.years} years</td></tr>`)
      .join("");
    dashaHtml = `
      <div style="margin: 20px 0; padding: 16px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #f59e0b;">
        <h3 style="color: #d97706; margin-top: 0;">Vimshottari Dasha Sequence</h3>
        <table style="font-size: 13px;">${dashaRows}</table>
        <p style="font-size: 11px; color: #6b7280; margin-bottom: 0;">▶ indicates the first (current/starting) period from birth.</p>
      </div>
    `;
  }

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
  <p>Thank you for choosing BhavishAI. Here is your complete personalized Vedic astrology report. A <strong>PDF version</strong> is attached to this email for offline access.</p>
  <p><strong>Report ID:</strong> ${reportId}</p>
  <p><em>${summary || ""}</em></p>

  ${nakshatraHtml}
  ${planetTableHtml}
  ${luckyHtml}
  ${dashaHtml}
  
  ${(sections || [])
    .map(
      (s, i) => `
    <div class="section">
      <h2>${i + 1}. ${(s.title || "").replace(/^\d+\.\s*/, "")}</h2>
      <p>${(s.content || "").replace(/\n/g, "<br>")}</p>
    </div>`
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

export async function POST(request) {
  try {
    const { email, name, reportId, sections, summary, chartData, dateOfBirth, timeOfBirth, placeOfBirth, includeBump } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const html = buildReportHtml({ name, reportId, summary, sections, chartData });

    // Generate PDF server-side (non-blocking — if it fails, still send HTML email)
    let pdfBuffer = null;
    try {
      const pdfRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in"}/api/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, dateOfBirth, timeOfBirth, placeOfBirth, reportId, summary, sections, chartData }),
      });
      if (pdfRes.ok) {
        const pdfData = await pdfRes.json();
        if (pdfData.pdf) {
          pdfBuffer = Buffer.from(pdfData.pdf, "base64");
        }
      }
    } catch (pdfErr) {
      console.warn("PDF generation failed (sending email without attachment):", pdfErr.message);
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const subject = `Your Personalized Vedic Astrology Report - ${name}`;

    // Try Resend first (supports attachments)
    let result;
    try {
      const sendOptions = {
        from: `BhavishAI <${fromEmail}>`,
        to: [email],
        subject,
        html,
        reply_to: process.env.GMAIL_USER || fromEmail,
      };

      // Attach PDF if generated successfully
      if (pdfBuffer) {
        sendOptions.attachments = [
          {
            filename: `${name.replace(/\s+/g, "_")}_BhavishAI_Report.pdf`,
            content: pdfBuffer,
          },
        ];
      }

      const { data, error } = await resend.emails.send(sendOptions);
      if (error) throw new Error(error.message || "Resend failed");
      result = { provider: "resend", messageId: data?.id, hasPdf: !!pdfBuffer };
    } catch (resendError) {
      console.warn("Resend failed, trying Gmail fallback:", resendError.message);

      if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        return NextResponse.json(
          { error: "Email delivery failed. Your report is still available on-screen and can be downloaded." },
          { status: 500 }
        );
      }

      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
        });

        const mailOptions = {
          from: `BhavishAI <${process.env.GMAIL_USER}>`,
          to: email,
          subject,
          html,
        };

        if (pdfBuffer) {
          mailOptions.attachments = [
            { filename: `${name.replace(/\s+/g, "_")}_BhavishAI_Report.pdf`, content: pdfBuffer },
          ];
        }

        const info = await transporter.sendMail(mailOptions);
        result = { provider: "gmail", messageId: info.messageId, hasPdf: !!pdfBuffer };
      } catch (gmailError) {
        return NextResponse.json(
          { error: "Email delivery failed. Your report is still available on-screen and can be downloaded." },
          { status: 500 }
        );
      }
    }

    // Auto-send the "12-Month Guidance Pack confirmed" email when the ₹149 add-on
    // was purchased. Reuses the admin route (single source of truth — it re-validates
    // has_12_month_guidance from the DB and stamps guidance_email_sent_at). Best-effort:
    // never block the report email response on it.
    if (includeBump) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
        const adminSecret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
        if (adminSecret) {
          await fetch(`${baseUrl}/api/admin/send-guidance-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminSecret}` },
            body: JSON.stringify({ reportId }),
          });
        }
      } catch (guidanceErr) {
        console.warn("Guidance confirmation auto-send failed (non-critical):", guidanceErr.message);
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Email send error:", error);
    return NextResponse.json({ error: "Failed to send email." }, { status: 500 });
  }
}
