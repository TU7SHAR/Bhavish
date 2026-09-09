import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Read the persistent operational log (Supabase `ops_logs`).
//
// WHY: Vercel Hobby drops runtime logs quickly and Log Drains are Pro-only, so
// the app records its own ops events. This is the read side — a durable
// replacement for scrolling the Vercel dashboard before the evidence expires.
//
// GET /api/admin/logs
// Header: Authorization: Bearer <ADMIN_SECRET>
//
// Query params (all optional):
//   ?reportId=RPT-...      full timeline for ONE report (most useful for support)
//   ?event=payment.verified exact event name
//   ?prefix=meta            all events starting with "meta." (e.g. meta.purchase_sent)
//   ?level=error            info | warn | error  ('problems' = warn + error)
//   ?since=24h              5m | 3h | 24h | 7d | 30d   (default 7d)
//   ?limit=100              1-500 (default 100)
export const dynamic = "force-dynamic";

const SINCE_PATTERN = /^(\d+)([mhd])$/;

function sinceToISO(raw) {
  const match = SINCE_PATTERN.exec(raw || "");
  if (!match) return new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const amount = parseInt(match[1], 10);
  const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  const windowMs = Math.min(amount * unitMs, 90 * 86_400_000); // cap at retention
  return new Date(Date.now() - windowMs).toISOString();
}

export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("reportId");
  const event = searchParams.get("event");
  const prefix = searchParams.get("prefix");
  const level = searchParams.get("level");
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    let query = supabase
      .from("ops_logs")
      .select("id, created_at, level, event, report_id, source, message, meta")
      .gte("created_at", sinceToISO(searchParams.get("since")))
      .order("created_at", { ascending: false })
      .limit(limit);

    if (reportId) query = query.eq("report_id", reportId);
    if (event) query = query.eq("event", event);
    if (prefix) query = query.like("event", `${prefix}%`);
    if (level === "problems") query = query.in("level", ["warn", "error"]);
    else if (level) query = query.eq("level", level);

    const { data, error } = await query;

    if (error) {
      // Most likely cause: migration 009 hasn't been run yet. Say so plainly
      // instead of returning an opaque 500.
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          hint: "If this says the relation does not exist, run supabase/migrations/009_ops_logs.sql.",
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, count: data?.length || 0, logs: data || [] });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
