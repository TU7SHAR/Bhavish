import Link from "next/link";
import { headers } from "next/headers";
import { logHttp } from "../lib/http-log.js";

// Custom 404 page.
//
// TWO JOBS:
//  1. Record the 404. The proxy cannot see response statuses, so this server
//     component is the only place a page-level 404 is observable in-app. This is
//     how a broken internal link (e.g. the /blog/rashi-vs-lagna-chart 404 that
//     was previously only visible in Vercel's expiring logs) becomes queryable.
//  2. Give the visitor somewhere useful to go instead of a bare error — a dead
//     end on a paid-traffic landing page is wasted ad spend.
//
// Rendered dynamically so the logging actually runs per request.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Page Not Found",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  try {
    const h = await headers();
    // next-url carries the path that 404'd; referer shows what linked to it,
    // which is what tells us whether WE published the broken link.
    const path = h.get("next-url") || h.get("x-invoke-path") || "unknown";
    await logHttp({
      method: "GET",
      path,
      status: 404,
      source: "not-found",
      userAgent: h.get("user-agent") || undefined,
      referrer: h.get("referer") || undefined,
      country: h.get("x-vercel-ip-country") || undefined,
    });
  } catch {
    // Never let logging break the 404 page itself.
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-md text-center">
        <p className="text-primary text-sm font-medium tracking-wide uppercase mb-3">
          404
        </p>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          This page doesn&apos;t exist
        </h1>
        <p className="text-muted text-sm leading-relaxed mb-8">
          The link may be broken or the page may have moved. Your birth chart is
          still one minute away.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/get-report"
            className="inline-block bg-primary hover:bg-primary-dark text-white px-6 py-3 rounded-full font-medium transition-all"
          >
            Get Your Free Preview →
          </Link>
          <Link
            href="/"
            className="inline-block border border-border hover:border-primary/50 text-foreground px-6 py-3 rounded-full font-medium transition-all"
          >
            Back to Home
          </Link>
        </div>

        <div className="mt-10 text-sm">
          <Link href="/blog" className="text-muted hover:text-primary transition-colors">
            Browse astrology articles
          </Link>
        </div>
      </div>
    </main>
  );
}
