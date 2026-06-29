import { createClient } from "@supabase/supabase-js";

// Fetches AI-generated / dynamic blog posts stored in Supabase.
// Falls back gracefully to [] / null if the table doesn't exist yet or on any
// error, so the static blog keeps working before the migration is run.
//
// Expected table `blog_posts`:
//   slug TEXT PRIMARY KEY, title TEXT, description TEXT, content TEXT,
//   keywords JSONB, read_minutes INT, published BOOLEAN DEFAULT true,
//   created_at TIMESTAMPTZ DEFAULT now()

function client() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function normalize(row) {
  let date = new Date().toISOString().substring(0, 10);
  try {
    if (row.created_at) date = new Date(row.created_at).toISOString().substring(0, 10);
  } catch {}
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date,
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    readMinutes: row.read_minutes || 5,
    content: row.content,
    source: "db",
  };
}

// Treat only an explicit `false` as unpublished — null/undefined/true are live.
function isPublished(row) {
  return row.published !== false;
}

export async function getDbPosts() {
  try {
    const supabase = client();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.filter(isPublished).map(normalize);
  } catch {
    return [];
  }
}

export async function getDbPost(slug) {
  try {
    const supabase = client();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error || !data) return null;
    if (!isPublished(data)) return null;
    return normalize(data);
  } catch {
    return null;
  }
}
