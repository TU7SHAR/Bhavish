import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createServiceClient } from "../../../lib/supabase-service.js";

// Public route (auth-checked): fetch all monthly guidance reports for the
// logged-in user. Used by the user dashboard to display their monthly guidance.
//
// GET /api/guidance-reports?reportId=RPT-...
// Returns: { reports: [...] } ordered by month_number ascending.

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("reportId");

    if (!reportId) {
      return NextResponse.json({ error: "reportId is required." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const authClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    // Verify user is logged in
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    // Service-role client for the DB reads. We enforce ownership below by
    // matching the parent report's user_id to the authenticated user, so RLS
    // isn't relied upon here (guidance_reports has no public policy).
    const supabase = createServiceClient();

    // Verify the parent report belongs to this user
    const { data: parentReport } = await supabase
      .from("reports")
      .select("report_id, user_id, has_12_month_guidance")
      .eq("report_id", reportId)
      .eq("user_id", user.id)
      .single();

    if (!parentReport) {
      return NextResponse.json({ error: "Report not found or not yours." }, { status: 404 });
    }

    if (!parentReport.has_12_month_guidance) {
      return NextResponse.json({ error: "This report doesn't have the 12-Month Guidance Pack." }, { status: 403 });
    }

    // Fetch all guidance reports for this parent report
    const { data: reports, error: fetchErr } = await supabase
      .from("guidance_reports")
      .select("id, month_number, calendar_month, calendar_year, sections, full_text, generated_at, email_sent_at")
      .eq("parent_report_id", reportId)
      .order("month_number", { ascending: true });

    if (fetchErr) {
      // Table might not exist yet
      if (fetchErr.message?.includes("relation") || fetchErr.code === "42P01") {
        return NextResponse.json({ reports: [] });
      }
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    return NextResponse.json({ reports: reports || [] });
  } catch (error) {
    console.error("Guidance reports fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
