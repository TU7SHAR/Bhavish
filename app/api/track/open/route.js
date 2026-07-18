import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { trackingLimiter } from "../../../../lib/rate-limit.js";

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Logs email opens. Embedded as <img> in every email.
// GET /api/track/open?rid=REPORT_ID&en=EMAIL_NUMBER
// GET /api/track/open?rid=REPORT_ID&type=report   (report email open)
// GET /api/track/open?rid=REPORT_ID&type=thankyou  (thank you email open)
export async function GET(request) {
  try {
    // Rate limiting — prevent fake open injection
    const rateCheck = await trackingLimiter(request);
    if (!rateCheck.allowed) {
      // Still return pixel even when rate limited (don't break email display)
      return new NextResponse(PIXEL, {
        status: 200,
        headers: {
          "Content-Type": "image/gif",
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
    }

    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("rid");
    const emailNum = parseInt(searchParams.get("en") || "0", 10);
    const type = searchParams.get("type"); // "report" or "thankyou"

    // Basic validation — report IDs follow a known format
    if (reportId && reportId.startsWith("RPT-") && (emailNum > 0 || type)) {
      // Validate type is one of the expected values
      const validTypes = ["report", "thankyou", "guidance", "howto", "admin_reply"];
      if (type && !validTypes.includes(type)) {
        // Invalid type — return pixel without tracking
        return new NextResponse(PIXEL, {
          status: 200,
          headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" },
        });
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      const { data: report } = await supabase
        .from("reports")
        .select("email_opens")
        .eq("report_id", reportId)
        .single();

      const existingOpens = Array.isArray(report?.email_opens) ? report.email_opens : [];

      // Use special identifiers for paid emails
      const trackId = type === "report" ? "report_email" : type === "thankyou" ? "thankyou_email" : emailNum;

      // Only log first open per type (avoid duplicates)
      const alreadyTracked = existingOpens.some((o) =>
        type ? o.type === type : o.num === emailNum
      );

      if (!alreadyTracked) {
        const openEntry = type
          ? { type, opened_at: new Date().toISOString() }
          : { num: emailNum, opened_at: new Date().toISOString() };

        existingOpens.push(openEntry);

        await supabase
          .from("reports")
          .update({ email_opens: existingOpens })
          .eq("report_id", reportId);
      }
    }
  } catch (err) {
    // Never fail — always return the pixel regardless of DB issues
    console.error("Track open error:", err.message);
  }

  // Always return the pixel image
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}
