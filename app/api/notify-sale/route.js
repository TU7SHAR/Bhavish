import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

// Sends YOU (the owner) a notification whenever someone buys a report
export async function POST(request) {
  try {
    const { reportId, customerName, customerEmail, paymentId, amount, placeOfBirth, dateOfBirth } =
      await request.json();

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

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed; border-bottom: 2px solid #7c3aed; padding-bottom: 10px;">
          💰 New Sale on BhavishAI!
        </h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 8px 0; font-weight: bold; color: #374151;">Amount</td>
            <td style="padding: 8px 0; color: #059669; font-weight: bold; font-size: 18px;">₹${amount || "299"}</td>
          </tr>
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

        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          Check your Supabase dashboard or Razorpay dashboard for full details.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `BhavishAI Sales <${ownerEmail}>`,
      to: ownerEmail,
      subject: `💰 New Sale! ${customerName} paid ₹${amount || "299"} — BhavishAI`,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Owner notification error:", error.message);
    // Non-blocking — sale still counts even if notification fails
    return NextResponse.json({ success: true, notificationFailed: true });
  }
}
