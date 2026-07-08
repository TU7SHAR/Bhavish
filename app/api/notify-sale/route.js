import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { verifyInternal } from "../../../lib/auth.js";

// Sends YOU (the owner) a notification whenever someone buys a report
export async function POST(request) {
  try {
    // SECURITY FIX: Verify authorization.
    // Accept either:
    // 1. Internal auth header (server-to-server calls), OR
    // 2. Verify the report has a valid payment in DB (for client post-payment calls)
    const auth = verifyInternal(request);
    const isInternalCall = auth.authorized;

    const { reportId, customerName, customerEmail, paymentId, amount, placeOfBirth, dateOfBirth, includeBump, isUpgrade, reportComplete } =
      await request.json();

    // If not an internal call, verify the payment actually exists
    if (!isInternalCall) {
      if (!reportId || !paymentId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data: report } = await supabase
        .from("reports")
        .select("payment_status, payment_id")
        .eq("report_id", reportId)
        .single();

      if (!report || report.payment_status !== "paid") {
        return NextResponse.json({ error: "Unauthorized: payment not verified" }, { status: 403 });
      }
    }

    // A paid sale whose report did NOT pass the quality check — needs YOUR action.
    const reportFailed = reportComplete === false && !isUpgrade;

    const ownerEmail = process.env.GMAIL_USER;
    if (!ownerEmail || !process.env.GMAIL_APP_PASSWORD) {
      console.warn("Owner notification skipped: Gmail not configured");
      return NextResponse.json({ success: true, skipped: true });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Build breakdown
    let breakdown = `<tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px 0; font-weight: bold; color: #374151;">Amount</td>
      <td style="padding: 8px 0; color: #059669; font-weight: bold; font-size: 18px;">₹${amount || "299"}</td>
    </tr>`;

    if (includeBump) {
      breakdown += `<tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Breakdown</td>
        <td style="padding: 8px 0;">₹299 (Report) + ₹149 (12-Month Guidance) = <strong>₹448</strong></td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">📅 Guidance</td>
        <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">12-Month Personal Guidance PURCHASED ✅</td>
      </tr>`;
    }

    if (isUpgrade) {
      breakdown = `<tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">Amount</td>
        <td style="padding: 8px 0; color: #059669; font-weight: bold; font-size: 18px;">₹${amount || "999"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 8px 0; font-weight: bold; color: #374151;">🎖️ Type</td>
        <td style="padding: 8px 0; color: #f59e0b; font-weight: bold;">FOUNDER MEMBER UPGRADE ⭐</td>
      </tr>`;
    }

    const failBanner = reportFailed
      ? `<div style="background:#fef2f2;border:2px solid #dc2626;border-radius:8px;padding:14px;margin-bottom:16px;">
           <p style="margin:0;color:#dc2626;font-weight:bold;font-size:15px;">⚠️ REPORT FAILED QUALITY CHECK — customer was NOT emailed.</p>
           <p style="margin:6px 0 0;color:#374151;font-size:13px;">This customer paid but the full report was incomplete. Regenerate it in the admin panel and resend BEFORE they notice. Report ID: <strong>${reportId}</strong></p>
         </div>`
      : "";

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        ${failBanner}
        <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
          ${isUpgrade ? "🎖️ Founder Upgrade!" : reportFailed ? "💰 New Sale (⚠️ report failed)" : "💰 New Sale on BhavishAI!"}
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          ${breakdown}
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Customer</td>
            <td style="padding: 8px 0;">${customerName || "Unknown"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Email</td>
            <td style="padding: 8px 0;">${customerEmail || "Not provided"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">DOB</td>
            <td style="padding: 8px 0;">${dateOfBirth || "-"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Place</td>
            <td style="padding: 8px 0;">${placeOfBirth || "-"}</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Payment ID</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${paymentId || "-"}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Report ID</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 12px;">${reportId || "-"}</td>
          </tr>
        </table>
      </div>
    `;

    const subject = isUpgrade
      ? `🎖️ FOUNDER UPGRADE! ${customerName} paid ₹${amount || "999"} — BhavishAI`
      : reportFailed
        ? `⚠️ ACTION NEEDED: ${customerName} paid ₹${amount || "299"} but report FAILED — regenerate & resend`
        : `💰 New Sale! ${customerName} paid ₹${amount || "299"}${includeBump ? " (includes 12-mo guidance)" : ""} — BhavishAI`;

    await transporter.sendMail({
      from: `BhavishAI Sales <${ownerEmail}>`,
      to: ownerEmail,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Owner notification error:", error.message);
    return NextResponse.json({ success: true, notificationFailed: true });
  }
}
