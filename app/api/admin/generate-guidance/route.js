import { generateWithRetry } from "../../../../lib/gemini-retry.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { mdToHtml } from "../../../../lib/markdown.js";

// Admin route: Generate a single month's guidance report for a customer.
// POST /api/admin/generate-guidance
// Body: { reportId, monthNumber (1-12) }
// Auth: Bearer ADMIN_SECRET

export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId, monthNumber, force } = await request.json();

    if (!reportId || !monthNumber || monthNumber < 1 || monthNumber > 12) {
      return NextResponse.json({ error: "reportId and monthNumber (1-12) required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the parent report
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("*")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (!report.has_12_month_guidance) {
      return NextResponse.json({ error: "This customer hasn't purchased the 12-Month Guidance Pack." }, { status: 400 });
    }

    // Check if this month already exists
    const { data: existing } = await supabase
      .from("guidance_reports")
      .select("id")
      .eq("parent_report_id", reportId)
      .eq("month_number", monthNumber)
      .single();

    if (existing && !force) {
      return NextResponse.json({ error: `Month ${monthNumber} guidance already exists for this customer. Use force=true to regenerate.` }, { status: 400 });
    }

    // If regenerating, delete the old one first
    if (existing && force) {
      await supabase
        .from("guidance_reports")
        .delete()
        .eq("parent_report_id", reportId)
        .eq("month_number", monthNumber);
    }

    // Determine the actual calendar month for this guidance month
    const startDate = report.guidance_start_date ? new Date(report.guidance_start_date) : new Date(report.created_at);
    const targetMonth = new Date(startDate);
    targetMonth.setMonth(targetMonth.getMonth() + (monthNumber - 1));
    const calendarMonth = MONTH_NAMES[targetMonth.getMonth()];
    const calendarYear = targetMonth.getFullYear();

    // Build chart context
    const chartData = report.chart_data || {};
    const planetaryTable = chartData.planets
      ? Object.entries(chartData.planets).map(([planet, d]) => `${planet}: ${d.sign} (${d.degree}) House ${d.house} ${d.dignity || ""}`).join("\n")
      : "Not available";
    const dashaInfo = (chartData.dasha || []).map((d, i) => `${d.planet}: ${d.years}yr`).join(", ");
    const currentDasha = chartData.dashaTimeline?.currentMahadasha || "Unknown";

    // Generate with Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

    const prompt = `You are a professional Vedic astrologer writing a MONTHLY guidance report.

PERSON:
- Name: ${report.name}
- Gender: ${report.gender || "unknown"}
- DOB: ${report.date_of_birth}
- Time: ${report.time_of_birth}
- Place: ${report.place_of_birth}
- Current Mahadasha: ${currentDasha}

PLANETARY POSITIONS:
${planetaryTable}

DASHA SEQUENCE: ${dashaInfo}

TASK: Write a detailed, personalised guidance report for **${calendarMonth} ${calendarYear}** (Month ${monthNumber} of their 12-month guidance pack).

The report must include these sections (use these exact headings):

## Overview
A 2-3 sentence summary of what this month holds for them overall.

## Career & Work
What to focus on, opportunities, risks, timing for career moves this month.

## Money & Finances
Financial outlook — earning potential, spending caution, investment timing.

## Love & Relationships
Relationship energy this month — harmony, tension, communication advice.

## Health & Wellness
Physical and mental health focus areas, what to protect.

## Key Dates & Timing Windows
3-5 specific date ranges or weeks within this month that are important (good or cautious).

## Action Plan
5-7 bullet points of practical, specific things to do this month.

## Remedies & Suggestions
2-3 simple, safe remedies (meditation, mantra, charity, discipline, journaling).

## Month Rating
Rate this month out of 10 and explain in one sentence why.

RULES:
- Be specific to THEIR chart, not generic.
- Reference planetary transits affecting their specific houses.
- Write in second person ("you").
- Total length: 600-900 words.
- Keep it practical and actionable.
- Do NOT use asterisks or markdown bold. Use plain text.
- Output ONLY the content. No preamble.`;

    const result = await generateWithRetry(model, prompt);
    const text = result.response.text();

    if (!text || text.length < 200) {
      return NextResponse.json({ error: "Gemini returned insufficient content. Try again." }, { status: 500 });
    }

    // Parse sections from the response
    const sectionRegex = /^##\s+(.+)/gm;
    const matches = [...text.matchAll(sectionRegex)];
    let sections = [];

    if (matches.length >= 4) {
      sections = matches.map((match, i) => {
        const start = match.index + match[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
        return {
          title: match[1].trim(),
          content: text.slice(start, end).trim(),
        };
      });
    } else {
      // Fallback: store as single section
      sections = [{ title: `${calendarMonth} ${calendarYear} Guidance`, content: text }];
    }

    // Save to guidance_reports table
    const guidanceData = {
      parent_report_id: reportId,
      month_number: monthNumber,
      calendar_month: calendarMonth,
      calendar_year: calendarYear,
      sections,
      full_text: text,
      generated_at: new Date().toISOString(),
      email: report.email,
      name: report.name,
    };

    const { error: insertErr } = await supabase
      .from("guidance_reports")
      .insert(guidanceData);

    if (insertErr) {
      // If the table doesn't exist yet, give a helpful error
      if (insertErr.message?.includes("relation") || insertErr.code === "42P01") {
        return NextResponse.json({
          error: "The guidance_reports table doesn't exist yet. Run the SQL migration first.",
          sql: `CREATE TABLE IF NOT EXISTS guidance_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_report_id TEXT NOT NULL,
  month_number INTEGER NOT NULL CHECK (month_number >= 1 AND month_number <= 12),
  calendar_month TEXT,
  calendar_year INTEGER,
  sections JSONB,
  full_text TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  email TEXT,
  name TEXT,
  email_sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  UNIQUE(parent_report_id, month_number)
);
CREATE INDEX idx_guidance_parent ON guidance_reports(parent_report_id);`,
        }, { status: 500 });
      }
      return NextResponse.json({ error: `Failed to save: ${insertErr.message}` }, { status: 500 });
    }

    // Send email notification to the customer
    let emailSent = false;
    if (report.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

        const emailHtml = buildGuidanceEmailHtml({
          name: report.name,
          monthNumber,
          calendarMonth,
          calendarYear,
          sections,
          reportId,
        });

        await resend.emails.send({
          from: `BhavishAI <${fromEmail}>`,
          to: [report.email],
          subject: `📅 Your ${calendarMonth} ${calendarYear} Guidance Report is ready — Month ${monthNumber}/12`,
          html: emailHtml,
          reply_to: process.env.GMAIL_USER || fromEmail,
        });
        emailSent = true;

        // Mark email sent
        await supabase
          .from("guidance_reports")
          .update({ email_sent_at: new Date().toISOString() })
          .eq("parent_report_id", reportId)
          .eq("month_number", monthNumber);
      } catch (emailErr) {
        console.error("Guidance email failed:", emailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      monthNumber,
      calendarMonth,
      calendarYear,
      sectionCount: sections.length,
      emailSent,
      email: report.email,
    });
  } catch (error) {
    console.error("Generate guidance error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function buildGuidanceEmailHtml({ name, monthNumber, calendarMonth, calendarYear, sections, reportId }) {
  const sectionsHtml = sections.map((s) => `
    <div style="margin-bottom:20px;padding:16px;background:#1a1a2e;border-radius:12px;border-left:4px solid #3b82f6;">
      <h3 style="color:#93c5fd;margin:0 0 8px 0;font-size:15px;">${s.title}</h3>
      <p style="color:#e2e8f0;margin:0;font-size:13px;line-height:1.7;">${mdToHtml(s.content.substring(0, 300) + (s.content.length > 300 ? "..." : ""))}</p>
    </div>
  `).join("");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;padding:0;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#a78bfa;margin:0;">✨ BhavishAI</h1>
      <p style="color:#6b7280;font-size:12px;margin:4px 0 0;">12-Month Guidance Pack</p>
    </div>
    <div style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:28px;">
      <div style="text-align:center;margin-bottom:20px;">
        <span style="display:inline-block;background:#1e40af;color:#93c5fd;font-size:11px;font-weight:700;padding:6px 14px;border-radius:50px;text-transform:uppercase;letter-spacing:1px;">Month ${monthNumber} of 12</span>
      </div>
      <h2 style="color:#f9fafb;margin:0 0 4px;text-align:center;">${calendarMonth} ${calendarYear} Guidance</h2>
      <p style="color:#9ca3af;text-align:center;font-size:13px;margin:0 0 24px;">Hi ${name}, your monthly guidance report is ready.</p>
      ${sectionsHtml}
      <div style="text-align:center;margin-top:24px;">
        <a href="https://www.bhavishai.in/dashboard" style="display:inline-block;background:#3b82f6;color:white;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:600;font-size:14px;">View Full Report in Dashboard →</a>
      </div>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:20px;">&copy; ${new Date().getFullYear()} BhavishAI | bhavishai.in</p>
  </div>
  <img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent(reportId)}&type=guidance_m${monthNumber}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
}
