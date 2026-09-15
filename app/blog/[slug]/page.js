import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "../../components/Header";
import Footer from "../../components/Footer";
import { posts } from "../../../lib/blog-posts";
import { getDbPost } from "../../../lib/blog-db";
import { articleSchema, breadcrumbSchema } from "../../../lib/schema";

const BASE_URL = "https://www.bhavishai.in";

// Always render on the server per-request so newly published DB articles
// (and the static ones) are always found. No static caching of 404s.
export const dynamic = "force-dynamic";

// Look up a post by slug from static first, then DB.
async function findPost(slug) {
  const staticPost = posts.find((p) => p.slug === slug);
  if (staticPost) return staticPost;
  return await getDbPost(slug);
}

// Per-article SEO metadata.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const post = await findPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${BASE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description },
  };
}

// Score a candidate post's topical relevance to the current post, so "Read
// next" links to genuinely related articles instead of the first 3 in the file.
// Shared keywords are worth most; shared title words are a secondary signal.
// Good internal linking passes ranking equity to the pages that need it and
// keeps readers on-site — both lift SEO. (Previously this was a blind slice(0,3).)
function relevanceScore(candidate, current) {
  const curKw = new Set((current.keywords || []).map((k) => String(k).toLowerCase()));
  const canKw = (candidate.keywords || []).map((k) => String(k).toLowerCase());
  let score = 0;
  for (const k of canKw) if (curKw.has(k)) score += 3;

  const stop = new Set(["what", "is", "the", "a", "to", "in", "your", "of", "and", "for", "how", "vs", "guide", "vedic", "astrology", "kundli"]);
  const words = (t) => new Set(String(t || "").toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !stop.has(w)));
  const curWords = words(current.title);
  for (const w of words(candidate.title)) if (curWords.has(w)) score += 1;

  return score;
}

export default async function BlogPost({ params }) {
  const { slug } = await params;
  const post = await findPost(slug);
  if (!post) notFound();

  // Related posts: rank the static set by topical relevance to THIS post, then
  // fall back to filling with recent posts so we always show 3. Static-only
  // keeps this fast and avoids an extra DB round-trip per article view.
  const scored = posts
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({ p, score: relevanceScore(p, post) }))
    .sort((a, b) => b.score - a.score);
  const relevant = scored.filter((x) => x.score > 0).slice(0, 3).map((x) => x.p);
  const related =
    relevant.length >= 3
      ? relevant
      : [...relevant, ...scored.filter((x) => x.score === 0).map((x) => x.p)].slice(0, 3);

  const articleLd = articleSchema({
    title: post.title,
    description: post.description,
    slug: post.slug,
    date: post.date,
  });
  const breadcrumbLd = breadcrumbSchema([
    { name: "Home", url: BASE_URL },
    { name: "Blog", url: `${BASE_URL}/blog` },
    { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <Header />
      <main className="flex-1 pt-24 pb-16">
        <article className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="text-xs text-muted mb-6 flex items-center gap-2">
            <Link href="/" className="hover:text-foreground">Home</Link>
            <span>/</span>
            <Link href="/blog" className="hover:text-foreground">Blog</Link>
          </nav>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold mb-3 leading-tight">{post.title}</h1>
          <div className="flex items-center gap-3 text-xs text-muted mb-8">
            <span>{new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
            <span>·</span>
            <span>{post.readMinutes} min read</span>
          </div>

          {/* Content */}
          <div
            className="blog-content text-muted leading-relaxed space-y-4"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* CTA */}
          <div className="mt-10 bg-surface border border-primary/30 rounded-2xl p-6 text-center">
            <h3 className="text-lg font-bold mb-2">See what your own chart reveals</h3>
            <p className="text-muted text-sm mb-4">Get a personalized Vedic astrology report in 60 seconds, from ₹299. Free preview, no payment required to start.</p>
            <Link href="/get-report" className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full font-medium transition-all">
              Get Your Free Preview →
            </Link>
          </div>

          {/* Related */}
          {related.length > 0 && (
            <div className="mt-10">
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-4">Read next</h3>
              <div className="space-y-3">
                {related.map((p) => (
                  <Link key={p.slug} href={`/blog/${p.slug}`} className="block bg-surface border border-border rounded-xl p-4 hover:border-primary transition-all">
                    <p className="font-medium">{p.title}</p>
                    <p className="text-muted text-xs mt-1">{p.readMinutes} min read</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}
