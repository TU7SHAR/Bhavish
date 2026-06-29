import { createClient } from "@supabase/supabase-js";

// Fetches AI-generated / dynamic blog posts stored in Supabase.
// Falls back gracefully to [] if the table doesn't exist yet or on any error,
// so the static blog keeps working before the migration is run.
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
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    date: row.created_at ? row.created_at.substring(0, 10) : new Date().toISOString().substring(0, 10),
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    readMinutes: row.read_minutes || 5,
    content: row.content,
    source: "db",
  };
}

export async function getDbPosts() {
  try {
    const supabase = client();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data.map(normalize);
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
      .eq("published", true)
      .single();
    if (error || !data) return null;
    return normalize(data);
  } catch {
    return null;
  }
}
