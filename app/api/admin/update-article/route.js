import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../../../lib/auth.js";
import { logEvent, logError } from "../../../../lib/ops-log.js";

// Admin: edit an EXISTING blog article's SEO fields (title / description /
// keywords / content / published) without regenerating it.
//
// WHY THIS EXISTS:
// The highest-traffic articles (e.g. lagna-chart-vs-moon-chart with 689
// impressions, sade-sati with 151) live in the Supabase `blog_posts` table.
// There was previously NO way to edit their title or meta description — only to
// generate brand-new articles. Since the biggest CTR wins come from rewriting
// the title/description of pages that already rank, this endpoint fills that gap.
//
// POST /api/admin/update-article
// Header: Authorization: Bearer <ADMIN_SECRET>
// Body: {
//   slug: "what-is-sade-sati-...",   // required — which article
//   title?, description?, keywords?, content?, published?  // any subset to change
// }
export const dynamic = "force-dynamic";

export async function POST(request) {
  const auth = verifyAdmin(request);
  if (!auth.authorized) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { slug, title, description, keywords, content, published } = body || {};
  if (!slug) {
    return NextResponse.json({ error: "slug is required" }, { status: 400 });
  }

  // Only update the fields actually provided — never blank out others.
  const patch = {};
  if (typeof title === "string") patch.title = title.trim();
  if (typeof description === "string") patch.description = description.trim();
  if (Array.isArray(keywords)) patch.keywords = keywords;
  if (typeof content === "string") patch.content = content;
  if (typeof published === "boolean") patch.published = published;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update — provide at least one of title, description, keywords, content, published" }, { status: 400 });
  }

  // Guardrails so a rewrite can't accidentally hurt SEO.
  if (patch.title && (patch.title.length < 15 || patch.title.length > 70)) {
    return NextResponse.json({ error: `title should be 15-70 chars for SEO (got ${patch.title.length})` }, { status: 400 });
  }
  if (patch.description && (patch.description.length < 50 || patch.description.length > 165)) {
    return NextResponse.json({ error: `description should be 50-165 chars for SEO (got ${patch.description.length})` }, { status: 400 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data, error } = await supabase
      .from("blog_posts")
      .update(patch)
      .eq("slug", slug)
      .select("slug, title, description, published");

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 200 });
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ ok: false, error: `No article found with slug "${slug}" (is it a DB article? static articles live in code).` }, { status: 404 });
    }

    await logEvent({
      event: "admin.article_updated",
      source: "admin-update-article",
      message: `updated ${Object.keys(patch).join(", ")} on ${slug}`,
      meta: { slug, fields: Object.keys(patch) },
    });

    return NextResponse.json({ ok: true, updated: Object.keys(patch), article: data[0] });
  } catch (e) {
    await logError({ event: "admin.article_update_failed", source: "admin-update-article", message: e.message, error: e });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
