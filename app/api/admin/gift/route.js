import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";
import { generateFullReport } from "../../../../lib/report-generation.js";
import { calculateBirthChart } from "../../../../lib/vedic-calculator.js";
import { geocodePlace } from "../../../../lib/geocode.js";
import { deliverReport } from "../../../../lib/fulfill-payment.js";

// Admin-only: gift a customer a product or upgrade their report tier.
// POST /api/admin/gift
// Body: { reportId, type: "guidance" | "founder" | "upgrade_premium" | "upgrade_master" }
// Auth: Bearer ADMIN_SECRET
//
// New types (three-tier model):
//   upgrade_premium  — upgrades report to Premium tier (sets plan_tier, adds guidance)
//   upgrade_master   — upgrades to Master tier (triggers deep-dive generation + email after)

// 60s: gifting an Essential generates a full 10-section report inline (~25s).
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function buildGiftEmail({ name, email, type }) {
  const isGuidance = type === "guidance";
  const isPremium = type === "upgrade_premium";
  const isMaster = type === "upgrade_master";

  const isEssential = type === "essential";

  const title = isGuidance
    ? "You've been gifted the 12-Month Guidance Pack!"
    : isPremium
    ? "Your report has been upgraded to Premium!"
    : isMaster
    ? "Your report has been upgraded to Master!"
    : isEssential
    ? "Your personalized report is ready — on us!"
    : "You've been gifted a Founder Membership!";

  let what;
  if (isGuidance) {
    what = `<p style="margin-bottom:16px;">We've added the <strong>12-Month Personal Guidance Pack</strong> to your account — completely free, as a gift from us.</p>
       <p style="margin-bottom:8px;"><strong>What's included:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Month-by-month forecast (career, money, love, health) for 12 months</li>
         <li>Best months for action & caution months</li>
         <li>Key timing windows — when to move, when to wait</li>
         <li>Practical monthly action plan & personal remedies</li>
       </ul>
       <p style="margin-bottom:16px;">Your guidance is included as a <strong>dedicated section in your full report</strong>. Open your report to see it.</p>`;
  } else if (isPremium) {
    what = `<p style="margin-bottom:16px;">Great news — your report has been upgraded to <strong>Premium</strong>!</p>
       <p style="margin-bottom:8px;"><strong>What this means for you:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Full 20-section in-depth analysis (career, marriage, health, dashas, yogas, remedies)</li>
         <li>12-month month-by-month guidance included</li>
         <li>Best timing windows and caution periods for the year ahead</li>
       </ul>
       <p style="margin-bottom:16px;">Open your report to see the complete Premium experience.</p>`;
  } else if (isMaster) {
    what = `<p style="margin-bottom:16px;">Your report has been upgraded to <strong>Master</strong> — our most complete offering!</p>
       <p style="margin-bottom:8px;"><strong>What's being added:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Full 20-section analysis + 12-month guidance</li>
         <li>7-part specialized deep-dive focused on your biggest concern</li>
         <li>24-month personalized roadmap with timing</li>
       </ul>
       <p style="margin-bottom:16px;">Your deep-dive is being generated now and will appear in your report within a few minutes.</p>`;
  } else if (isEssential) {
    what = `<p style="margin-bottom:16px;">We've prepared your <strong>personalized Vedic astrology report</strong> — completely free, as a gift from us.</p>
       <p style="margin-bottom:8px;"><strong>What's inside:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>10-section reading of your birth chart (personality, career, marriage, health & more)</li>
         <li>A direct answer to your personal concern</li>
         <li>Your lucky numbers, colours, gemstone and remedies</li>
       </ul>
       <p style="margin-bottom:16px;">Your report is being prepared now and will arrive in your inbox within a few minutes.</p>`;
  } else {
    what = `<p style="margin-bottom:16px;">We've upgraded your account to <strong>Founding Member</strong> status — completely free, as a gift from us.</p>
       <p style="margin-bottom:8px;"><strong>What this means:</strong></p>
       <ul style="margin:0 0 16px 20px;padding:0;color:#e2e8f0;">
         <li>Generate up to 5 free reports every month</li>
         <li>Use them for yourself, family, or friends</li>
         <li>Valid for 24 months (up to 120 total reports)</li>
         <li>Access via bhavishai.in → Google Sign In → My Reports → Generate Free Report</li>
       </ul>`;
  }

  const trackType = isGuidance ? "gift_guidance" : isPremium ? "gift_premium" : isMaster ? "gift_master" : isEssential ? "gift_essential" : "gift_founder";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0a0a0f;color:#e2e8f0;padding:0;margin:0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <h1 style="color:#a78bfa;margin:0;">✨ BhavishAI</h1>
    </div>
    <div style="background:#1a1a2e;border:1px solid #2d2d44;border-radius:16px;padding:32px;">
      <h2 style="color:#fbbf24;margin-top:0;">🎁 ${title}</h2>
      <p style="margin-bottom:16px;">Hi <strong>${name}</strong>,</p>
      ${what}
      <div style="text-align:center;margin:24px 0;">
        <a href="https://www.bhavishai.in/dashboard" style="display:inline-block;background:#8b5cf6;color:white;text-decoration:none;padding:14px 28px;border-radius:50px;font-weight:600;font-size:15px;">Open My Reports →</a>
      </div>
      <p style="color:#9ca3af;font-size:13px;margin-bottom:0;">Questions? Just reply to this email.</p>
    </div>
    <p style="text-align:center;color:#6b7280;font-size:11px;margin-top:24px;">&copy; ${new Date().getFullYear()} BhavishAI | bhavishai.in</p>
  </div>
  <img src="https://www.bhavishai.in/api/track/open?rid=${encodeURIComponent("gift")}&type=${trackType}" width="1" height="1" style="display:none;" alt="" />
</body>
</html>`;
}

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId, type } = await request.json();

    if (!reportId || !["guidance", "founder", "upgrade_premium", "upgrade_master", "essential"].includes(type)) {
      return NextResponse.json({ error: "reportId and type (guidance|founder|upgrade_premium|upgrade_master|essential) required." }, { status: 400 });
    }

    const supabase = getSupabase();

    // Fetch the report
    const { data: report, error: fetchErr } = await supabase
      .from("reports")
      .select("report_id, name, email, has_12_month_guidance, is_founder_member, payment_status")
      .eq("report_id", reportId)
      .single();

    if (fetchErr || !report) {
      return NextResponse.json({ error: "Report not found." }, { status: 404 });
    }

    if (!report.email) {
      return NextResponse.json({ error: "This customer has no email — cannot send gift notification." }, { status: 400 });
    }

    // Already has it?
    if (type === "guidance" && report.has_12_month_guidance) {
      return NextResponse.json({ error: "This customer already has the 12-Month Guidance Pack." }, { status: 400 });
    }
    if (type === "founder" && report.is_founder_member) {
      return NextResponse.json({ error: "This customer is already a Founder Member." }, { status: 400 });
    }
    // Never gift over a genuinely PAID row — that would wipe their real
    // payment_status and could downgrade what they bought.
    if (type === "essential" && report.payment_status === "paid") {
      return NextResponse.json({ error: "This customer already PAID — don't gift over a real purchase. Use Regenerate instead." }, { status: 400 });
    }

    // Update the DB
    const now = new Date();
    let updateData = {};
    if (type === "guidance") {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 12);
      updateData = {
        has_12_month_guidance: true,
        guidance_start_date: now.toISOString(),
        guidance_end_date: endDate.toISOString(),
        is_guidance_gifted: true,
      };
    } else if (type === "founder") {
      updateData = {
        is_founder_member: true,
        is_founder_gifted: true,
      };
    } else if (type === "upgrade_premium") {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 12);
      updateData = {
        plan_tier: "premium",
        plan_price: 499,
        guidance_months: 12,
        has_12_month_guidance: true,
        guidance_start_date: now.toISOString(),
        guidance_end_date: endDate.toISOString(),
        is_guidance_gifted: true,
      };
    } else if (type === "upgrade_master") {
      const endDate = new Date(now);
      endDate.setMonth(endDate.getMonth() + 12);
      updateData = {
        plan_tier: "master",
        plan_price: 999,
        guidance_months: 12,
        has_12_month_guidance: true,
        guidance_start_date: now.toISOString(),
        guidance_end_date: endDate.toISOString(),
        deep_dive_status: "pending",
        is_guidance_gifted: true,
      };
    } else if (type === "essential") {
      // GIFT a free Essential (₹299) report — e.g. to an unpaid lead.
      //
      // CRITICAL, by design:
      //  - payment_status is set to "gifted", NOT "paid". Revenue is only summed
      //    over payment_status === "paid" rows, so a gifted report is
      //    automatically excluded from all revenue/payment metrics — no analytics
      //    change needed.
      //  - This endpoint NEVER calls the Meta CAPI and NEVER fires notify-sale, so
      //    a gift can't show up as a Meta Purchase or an owner "New Sale".
      //  - is_essential_gifted marks it explicitly as a gift for reporting.
      updateData = {
        payment_status: "gifted",
        plan_tier: "essential",
        plan_price: 0, // gifted — no revenue value
        guidance_months: 0,
        is_essential_gifted: true,
      };
    }

    let { error: updateErr } = await supabase
      .from("reports")
      .update(updateData)
      .eq("report_id", reportId);

    // Progressive fallback: if a newer gifted-marker column doesn't exist yet
    // (is_essential_gifted / is_guidance_gifted / is_founder_gifted), retry
    // without those flags so the core gift still applies. The report is still
    // excluded from revenue via payment_status/plan_price, so this is safe.
    if (updateErr) {
      const { is_essential_gifted, is_guidance_gifted, is_founder_gifted, ...core } = updateData;
      const retry = await supabase.from("reports").update(core).eq("report_id", reportId);
      updateErr = retry.error;
    }

    if (updateErr) {
      return NextResponse.json({ error: `DB update failed: ${updateErr.message}` }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";

    const label = type === "guidance" ? "12-Month Guidance Pack"
      : type === "founder" ? "Founder Membership"
      : type === "upgrade_premium" ? "Premium Upgrade"
      : type === "upgrade_master" ? "Master Upgrade"
      : "Essential Report";

    // GIFTED ESSENTIAL: the report itself IS the deliverable. Generate the
    // 10-section Essential report and email it, WITHOUT touching revenue/CAPI/
    // sale-notification. We generate here and deliver via deliverReport (which
    // sends the customer the full report email + PDF). We deliberately do NOT
    // use regenerate-report because that endpoint (a) does not email the report
    // and (b) overwrites plan_price back to 299 — we must keep plan_price = 0.
    if (type === "essential") {
      let delivered = false;
      let note = "";
      try {
        // Need the birth details to (re)build the chart + generate.
        const { data: full } = await supabase
          .from("reports")
          .select("report_id, name, email, gender, date_of_birth, time_of_birth, place_of_birth, personal_question, plan_tier, plan_price, guidance_months, has_12_month_guidance, payment_status, sections")
          .eq("report_id", reportId)
          .single();

        if (!full?.date_of_birth || !full?.time_of_birth || !full?.place_of_birth) {
          note = "missing birth details — cannot generate";
        } else {
          // Only generate if a real report isn't already present (idempotent).
          if (!(Array.isArray(full.sections) && full.sections.length > 5)) {
            const location = await geocodePlace(full.place_of_birth);
            const chartData = calculateBirthChart({
              dateOfBirth: full.date_of_birth,
              timeOfBirth: full.time_of_birth,
              latitude: location.latitude,
              longitude: location.longitude,
              timezoneOffsetMinutes: location.timezoneOffsetMinutes,
            });
            const { summary, sections } = await generateFullReport({
              name: full.name,
              gender: full.gender,
              dateOfBirth: full.date_of_birth,
              timeOfBirth: full.time_of_birth,
              placeOfBirth: full.place_of_birth,
              chartData,
              personalQuestion: full.personal_question,
              tier: "essential",
              guidanceMonths: 0,
            });
            // Save the report WITHOUT disturbing the gift markers (no plan_price,
            // no payment_status here — those were set above to gifted / 0).
            await supabase
              .from("reports")
              .update({ summary, sections, chart_data: chartData, report_status: "completed" })
              .eq("report_id", reportId);
            full.sections = sections;
            full.summary = summary;
          }

          // Deliver the report email (deliverReport now allows 'gifted').
          const res = await deliverReport(
            supabase,
            full,
            { summary: full.summary, sections: full.sections },
            { notifyOwnerOfSale: false } // never fire the owner "New Sale" for a gift
          );
          delivered = !!res?.emailed;
          if (!delivered) note = res?.skipped || "delivery did not send";
        }
      } catch (genErr) {
        console.error("Gifted Essential generation/delivery failed:", genErr.message);
        note = genErr.message;
      }

      return NextResponse.json({
        success: true,
        email: report.email,
        message: delivered
          ? `Gifted a free Essential report to ${report.name} and emailed it. Not counted as revenue, no CAPI, no sale notification.`
          : `Marked ${report.name} as gifted Essential (payment_status=gifted), but delivery didn't complete (${note}). Use Resend Report to deliver.`,
        emailSent: delivered,
      });
    }

    // Send the gift/upgrade notification email (guidance/founder/premium/master).
    const html = buildGiftEmail({ name: report.name, email: report.email, type });
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const subject = type === "guidance"
      ? `🎁 You've been gifted the 12-Month Guidance Pack — ${report.name}`
      : type === "founder"
      ? `🎁 You've been gifted a Founder Membership — ${report.name}`
      : type === "upgrade_premium"
      ? `⭐ Your report has been upgraded to Premium — ${report.name}`
      : `★ Your report has been upgraded to Master — ${report.name}`;

    let emailSent = false;
    try {
      const { error: sendErr } = await resend.emails.send({
        from: `BhavishAI <${fromEmail}>`,
        to: [report.email],
        subject,
        html,
        reply_to: process.env.GMAIL_USER || fromEmail,
      });
      if (sendErr) throw new Error(sendErr.message);
      emailSent = true;
    } catch (emailErr) {
      console.error("Gift email failed:", emailErr.message);
      // Still return success for the DB update — admin can resend manually
    }

    // Master upgrade: trigger the deep-dive generation as a separate job.
    if (type === "upgrade_master") {
      fetch(`${baseUrl}/api/generate-master-deep-dive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      }).catch((e) => console.error("Deep-dive trigger after gift failed:", e.message));
    }

    return NextResponse.json({
      success: true,
      email: report.email,
      message: emailSent
        ? `Gifted ${label} to ${report.name} and sent notification email.`
        : `Gifted ${label} to ${report.name} (DB updated) but email failed — use resend button.`,
      emailSent,
    });
  } catch (error) {
    console.error("Gift error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
