import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getDbPost, getDbPosts } from "../../../../lib/blog-db";

// Temporary diagnostic: shows exactly what the public blog read sees.
// GET /api/admin/blog-debug?slug=optional-slug
// Header: Authorization: Bearer <ADMIN_SECRET or CRON_SECRET>
export const dynamic = "force-dynamic";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.ADMIN_SECRET || process.env.CRON_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");

  const diag = {
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // Raw query of all rows (so we see published value + columns)
    const { data: rawAll, error: rawErr } = await supabase
      .from("blog_posts")
      .select("slug, title, published, created_at")
      .order("created_at", { ascending: false });

    diag.rawQueryError = rawErr ? rawErr.message : null;
    diag.rowCount = Array.isArray(rawAll) ? rawAll.length : 0;
    diag.rows = (rawAll || []).map((r) => ({
      slug: r.slug,
      published: r.published,
      publishedType: typeof r.published,
      created_at: r.created_at,
    }));

    // What the helpers return
    const dbPosts = await getDbPosts();
    diag.getDbPostsCount = dbPosts.length;

    if (slug) {
      const single = await getDbPost(slug);
      diag.getDbPostResult = single ? { found: true, title: single.title } : { found: false };

      const { data: rawOne, error: oneErr } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      diag.rawSingleError = oneErr ? oneErr.message : null;
      diag.rawSingleFound = !!rawOne;
      if (rawOne) diag.rawSinglePublished = rawOne.published;
    }

    return NextResponse.json(diag);
  } catch (error) {
    diag.exception = error.message;
    return NextResponse.json(diag, { status: 500 });
  }
}
