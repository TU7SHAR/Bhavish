import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { verifyAdmin } from "../../../../lib/auth.js";

// Read the per-request HTTP log (Supabase `http_logs`) — the self-hosted
// equivalent of Vercel's runtime log view, without the Pro plan.
//
// GET /api/admin/http-logs
// Header: Authorization: Bearer <ADMIN_SECRET>
//
// Query params:
//   ?path=/get-report    exact path
//   ?prefix=/api         all paths starting with /api
//   ?status=404          exact status
//   ?errors=1            status >= 400 only
//   ?device=mobile       mobile | desktop | tablet | bot | unknown
//   ?since=24h           5m | 3h | 24h | 7d | 30d   (default 24h)
//   ?limit=100           1-500
//   ?summary=1           aggregate by path instead of listing rows
export const dynamic = "force-dynamic";

const SINCE_PATTERN = /^(\d+)([mhd])$/;

function sinceToISO(raw) {
  const match = SINCE_PATTERN.exec(raw || "");
  if (!match) return new Date(Date.now() - 86_400_000).toISOString(); // 24h
  const unitMs = { m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2]];
  const windowMs = Math.min(parseInt(match[1], 10) * unitMs, 30 * 86_400_000);
  return new Date(Date.now() - windowMs).toISOString();
}

export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const since = sinceToISO(searchParams.get("since"));
  const wantSummary = searchParams.get("summary") === "1";
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "100", 10) || 100, 1), 500);

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    let query = supabase
      .from("http_logs")
      .select("id, created_at, method, path, status, duration_ms, source, device, referrer, country")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(wantSummary ? 5000 : limit);

    const path = searchParams.get("path");
    const prefix = searchParams.get("prefix");
    const status = searchParams.get("status");
    const device = searchParams.get("device");

    if (path) query = query.eq("path", path);
    if (prefix) query = query.like("path", `${prefix}%`);
    if (status) query = query.eq("status", parseInt(status, 10));
    if (searchParams.get("errors") === "1") query = query.gte("status", 400);
    if (device) query = query.eq("device", device);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message,
          hint: "If this says the relation does not exist, run supabase/migrations/010_http_logs.sql.",
        },
        { status: 200 }
      );
    }

    if (!wantSummary) {
      return NextResponse.json({ ok: true, count: data?.length || 0, requests: data || [] });
    }

    // Aggregate by path: which pages get traffic, and where the errors are.
    const byPath = new Map();
    for (const row of data || []) {
      const entry = byPath.get(row.path) || { path: row.path, hits: 0, errors: 0, bots: 0 };
      entry.hits += 1;
      if (row.status && row.status >= 400) entry.errors += 1;
      if (row.device === "bot") entry.bots += 1;
      byPath.set(row.path, entry);
    }

    const summary = [...byPath.values()].sort((a, b) => b.hits - a.hits).slice(0, 100);
    return NextResponse.json({ ok: true, sampled: data?.length || 0, since, paths: summary });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
