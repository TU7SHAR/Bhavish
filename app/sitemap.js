import { posts } from "../lib/blog-posts";
import { getDbPosts } from "../lib/blog-db";

export default async function sitemap() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1.0 },
    { url: `${baseUrl}/get-report`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.9 },
    { url: `${baseUrl}/kundli/janam-kundli`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/kundli/kundli-by-date-of-birth`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/marriage/manglik-dosha`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/refund`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const staticSlugs = new Set(posts.map((p) => p.slug));
  const dbPosts = await getDbPosts();
  const allPosts = [...posts, ...dbPosts.filter((p) => !staticSlugs.has(p.slug))];

  // Only include posts that are actually live (published !== false and not
  // future-dated) so we never submit a hidden/scheduled article to Google.
  const now = Date.now();
  const blogRoutes = allPosts
    .filter((post) => post.published !== false && new Date(post.date).getTime() <= now)
    .map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: new Date(post.date),
      changeFrequency: "monthly",
      priority: 0.7,
    }));

  return [...staticRoutes, ...blogRoutes];
}
