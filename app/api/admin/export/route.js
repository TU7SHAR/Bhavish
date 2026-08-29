import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../../../lib/auth.js";

// Super admin data export — returns EVERYTHING in the admin dashboard as one
// payload so it can be downloaded (CSV or JSON) from the Actions tab.
//
// GET /api/admin/export
//   Header: Authorization: Bearer <ADMIN_SECRET or CRON_SECRET>
//   ?format=json (default) | csv
//   ?table=reports (default) | guidance | blog | all
//
// Unlike the tab-scoped /api/admin/data, this returns the FULL rows (including
// heavy JSONB like sections/email_drafts) because the point of an export is a
// complete backup. Test/QA accounts are INCLUDED here (an export is a backup,
// not a metrics view) but flagged so you can filter them downstream.
export const maxDuration = 60;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// RFC-4180-ish CSV escaping: wrap in quotes, double any internal quotes.
// Objects/arrays are JSON-stringified so nothing is lost in the flattening.
function csvCell(value) {
  if (value === null || value === undefined) return "";
  let str;
  if (typeof value === "object") str = JSON.stringify(value);
  else str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows) {
  if (!rows || rows.length === 0) return "";
  // Union of all keys across rows so no column is dropped for sparse rows.
  const keys = [];
  const seen = new Set();
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        keys.push(k);
      }
    }
  }
  const header = keys.map(csvCell).join(",");
  const lines = rows.map((row) => keys.map((k) => csvCell(row[k])).join(","));
  return [header, ...lines].join("\r\n");
}

export async function GET(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  const { searchParams } = new URL(request.url);
  const format = (searchParams.get("format") || "json").toLowerCase();
  const table = (searchParams.get("table") || "reports").toLowerCase();

  try {
    const supabase = getSupabase();

    // Fetch each dataset the admin cares about.
    async function fetchReports() {
      const { data } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    }
    async function fetchGuidance() {
      const { data, error } = await supabase
        .from("guidance_reports")
        .select("*")
        .order("parent_report_id", { ascending: true })
        .order("month_number", { ascending: true });
      // Table may not exist yet — return empty rather than failing the export.
      if (error && (error.message?.includes("relation") || error.code === "42P01")) return [];
      return data || [];
    }
    async function fetchBlog() {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error && (error.message?.includes("relation") || error.code === "42P01")) return [];
      return data || [];
    }

    // Single-table CSV export (a spreadsheet has one sheet).
    if (format === "csv") {
      let rows;
      if (table === "guidance") rows = await fetchGuidance();
      else if (table === "blog") rows = await fetchBlog();
      else rows = await fetchReports(); // default + "reports"

      const csv = toCsv(rows);
      const filename = `bhavishai-${table === "guidance" ? "guidance" : table === "blog" ? "blog" : "reports"}-${new Date().toISOString().slice(0, 10)}.csv`;
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // JSON export — the complete backup (all datasets in one file).
    const [reports, guidance, blog] = await Promise.all([
      fetchReports(),
      fetchGuidance(),
      fetchBlog(),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      counts: {
        reports: reports.length,
        guidance_reports: guidance.length,
        blog_posts: blog.length,
      },
      reports,
      guidance_reports: guidance,
      blog_posts: blog,
    };

    const filename = `bhavishai-full-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[admin/export] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
