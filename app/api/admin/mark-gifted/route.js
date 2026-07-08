import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Admin route: toggle is_guidance_gifted or is_founder_gifted on a report.
// POST /api/admin/mark-gifted
// Body: { reportId, field: "guidance" | "founder", value: true | false }
// Auth: Bearer ADMIN_SECRET

export async function POST(request) {
  // SECURITY FIX: Use timing-safe comparison
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  try {
    const { reportId, field, value } = await request.json();

    if (!reportId || !["guidance", "founder"].includes(field) || typeof value !== "boolean") {
      return NextResponse.json({ error: "reportId, field (guidance|founder), and value (true|false) required." }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const col = field === "guidance" ? "is_guidance_gifted" : "is_founder_gifted";

    const { error } = await supabase
      .from("reports")
      .update({ [col]: value })
      .eq("report_id", reportId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, field, value, reportId });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
