import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// 1x1 transparent GIF pixel
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

// Logs email opens. Embedded as <img> in every nurture email.
// GET /api/track/open?rid=REPORT_ID&en=EMAIL_NUMBER
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("rid");
    const emailNum = parseInt(searchParams.get("en") || "0", 10);

    if (reportId && emailNum > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Append to email_opens array: [{num, opened_at}]
      // Using raw SQL via rpc or a simple column approach.
      // We'll store opens in a JSONB column `email_opens` on reports.
      const { data: report } = await supabase
        .from("reports")
        .select("email_opens")
        .eq("report_id", reportId)
        .single();

      const existingOpens = Array.isArray(report?.email_opens) ? report.email_opens : [];
      
      // Only log first open per email number (avoid duplicates from re-opens)
      const alreadyTracked = existingOpens.some((o) => o.num === emailNum);
      if (!alreadyTracked) {
        existingOpens.push({
          num: emailNum,
          opened_at: new Date().toISOString(),
        });

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
