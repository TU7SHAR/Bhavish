import Link from "next/link";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { posts } from "../../lib/blog-posts";
import { getDbPosts } from "../../lib/blog-db";

export const metadata = {
  title: "Vedic Astrology Blog — Janam Kundli, Dasha & Nakshatra Guides",
  description:
    "Learn Vedic astrology: Janam Kundli basics, Vimshottari Dasha, Manglik Dosha, Nakshatras and more. Clear, beginner-friendly guides from BhavishAI.",
  alternates: { canonical: "https://www.bhavishai.in/blog" },
};

// Always render fresh so newly published articles appear immediately.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 12; // articles per page

// Merge static + DB posts, keep only LIVE ones (published !== false and not
// future-dated), newest first. Kept out of the component body so time reads
// aren't flagged as impure render logic. This is what lets us ship many
// articles in one commit but RELEASE them in waves (set `published: false`
// or a future `date` to keep one hidden until ready).
function getVisiblePosts(dbPosts) {
  const staticSlugs = new Set(posts.map((p) => p.slug));
  const merged = [...posts, ...dbPosts.filter((p) => !staticSlugs.has(p.slug))];
  const now = Date.now();
  return merged
    .filter((p) => p.published !== false && new Date(p.date).getTime() <= now)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default async function BlogIndex({ searchParams }) {
  const dbPosts = await getDbPosts();
  const sorted = getVisiblePosts(dbPosts);

  // Pagination via ?page=N.
  const sp = await searchParams;
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const rawPage = parseInt(sp?.page, 10);
  const page = Math.min(Math.max(Number.isNaN(rawPage) ? 1 : rawPage, 1), totalPages);
  const start = (page - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  const pageHref = (n) => (n === 1 ? "/blog" : `/blog?page=${n}`);

  return (
    <>
      <Header />
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-3">Vedic Astrology Blog</h1>
            <p className="text-muted">
              Clear, beginner-friendly guides to Janam Kundli, planetary periods, Nakshatras, and more.
            </p>
          </div>

          <div className="space-y-4">
            {pageItems.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block bg-surface border border-border rounded-2xl p-6 hover:border-primary transition-all"
              >
                <h2 className="text-xl font-bold mb-2">{post.title}</h2>
                <p className="text-muted text-sm mb-3">{post.description}</p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span>{new Date(post.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span>
                  <span>·</span>
                  <span>{post.readMinutes} min read</span>
                  <span className="ml-auto text-primary-light font-medium">Read →</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Blog pagination">
              {page > 1 && (
                <Link href={pageHref(page - 1)} className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-muted hover:border-primary hover:text-foreground transition-all">
                  ← Prev
                </Link>
              )}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={pageHref(n)}
                  aria-current={n === page ? "page" : undefined}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    n === page
                      ? "bg-primary border-primary text-white font-semibold"
                      : "bg-surface border-border text-muted hover:border-primary hover:text-foreground"
                  }`}
                >
                  {n}
                </Link>
              ))}
              {page < totalPages && (
                <Link href={pageHref(page + 1)} className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-muted hover:border-primary hover:text-foreground transition-all">
                  Next →
                </Link>
              )}
            </nav>
          )}

          {/* CTA */}
          <div className="mt-10 bg-surface border border-primary/30 rounded-2xl p-6 text-center">
            <h3 className="text-lg font-bold mb-2">Ready to see your own chart?</h3>
            <p className="text-muted text-sm mb-4">Get a personalized Vedic astrology report based on your exact birth details, from ₹299.</p>
            <Link href="/get-report" className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full font-medium transition-all">
              Get Your Free Preview →
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
