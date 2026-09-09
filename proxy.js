import { NextResponse } from "next/server";
import { logHttp } from "./lib/http-log.js";

/**
 * Next.js 16 Proxy for BhavishAI
 * (Replaces deprecated middleware.js convention)
 * 
 * Provides:
 * 1. Security headers on all responses
 * 2. CSRF protection on mutating API requests (POST/PUT/DELETE)
 * 3. Blocks suspicious automated requests
 */

// Routes that are exempt from CSRF origin checks:
// - Cron routes (called by Vercel Cron with Authorization header)
// - Track/open (called from email clients loading images)
// - Auth callback (OAuth redirect)
// - Webhook-style routes that use their own auth (admin routes use Bearer tokens)
const CSRF_EXEMPT_PATTERNS = [
  /^\/api\/cron\//,
  /^\/api\/track\//,
  /^\/api\/admin\//,
  /^\/api\/manual-send-emails/,
  /^\/api\/backfill-email-drafts/,
  /^\/auth\//,
  /^\/api\/unsubscribe/, // Public unsubscribe must work from email links
];

// Allowed origins for CSRF protection
function getAllowedOrigins() {
  const origins = [
    "https://www.bhavishai.in",
    "https://bhavishai.in",
  ];
  // Allow localhost in development
  if (process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_APP_URL?.includes("localhost")) {
    origins.push("http://localhost:3000", "http://localhost:3001");
  }
  // Allow the configured app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }
  return origins;
}

export function proxy(request, event) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── REQUEST LOGGING ──────────────────────────────────────────────────────
  // One row per real request (the matcher below already excludes static assets),
  // so we get the "Vercel logs" view in our own DB and keep it as long as we like.
  //
  // NON-BLOCKING: handed to event.waitUntil() so the DB insert happens AFTER the
  // response is sent. This must never add latency to time-to-first-byte.
  //
  // NOTE ON STATUS: the proxy runs BEFORE the response exists, so it cannot know
  // the eventual status code — those rows store status NULL. Statuses we DO know
  // are recorded: the 403s below, 404s from app/not-found.js, and any route
  // wrapped in withHttpLog().
  const logRequest = (status) =>
    logHttp({
      method,
      path: pathname,
      status,
      source: "proxy",
      userAgent: request.headers.get("user-agent") || undefined,
      referrer: request.headers.get("referer") || undefined,
      country: request.headers.get("x-vercel-ip-country") || undefined,
    });

  const track = (status) => {
    const pending = logRequest(status);
    // event may be absent in tests/older runtimes — degrade to fire-and-forget.
    if (event && typeof event.waitUntil === "function") event.waitUntil(pending);
    else void pending;
  };

  // --- CSRF Protection for mutating API requests ---
  if (
    pathname.startsWith("/api/") &&
    ["POST", "PUT", "DELETE", "PATCH"].includes(method)
  ) {
    // Check if route is CSRF-exempt
    const isExempt = CSRF_EXEMPT_PATTERNS.some((pattern) => pattern.test(pathname));

    if (!isExempt) {
      const origin = request.headers.get("origin");
      const referer = request.headers.get("referer");

      // If origin header is present, validate it
      if (origin) {
        const allowedOrigins = getAllowedOrigins();
        const isAllowed = allowedOrigins.some((allowed) => origin === allowed);

        if (!isAllowed) {
          // Check if request has a valid Bearer token (internal/admin calls)
          const authHeader = request.headers.get("authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            track(403); // status IS known here
            return NextResponse.json(
              { error: "Forbidden: invalid origin" },
              { status: 403 }
            );
          }
          // Has Bearer token — allow (admin/internal call from different origin)
        }
      }
      // If no origin header (same-origin requests, server-side fetches), allow through
      // The referer can also be used as a fallback check
      else if (referer) {
        const refererUrl = new URL(referer);
        const allowedOrigins = getAllowedOrigins();
        const isAllowedReferer = allowedOrigins.some(
          (allowed) => refererUrl.origin === allowed || refererUrl.origin === new URL(allowed).origin
        );
        if (!isAllowedReferer) {
          const authHeader = request.headers.get("authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            track(403); // status IS known here
            return NextResponse.json(
              { error: "Forbidden: invalid referer" },
              { status: 403 }
            );
          }
        }
      }
    }
  }

  // Request allowed through. Status is not knowable here (see note above), so
  // it is recorded as NULL; 404s arrive separately from app/not-found.js.
  track(undefined);

  // --- Response with security headers ---
  const response = NextResponse.next();

  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Enable XSS filter (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Referrer policy — send origin only to same-origin, nothing cross-origin
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy — disable unnecessary browser features
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  // HSTS — enforce HTTPS (Vercel handles certs)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  return response;
}

// Only run proxy on relevant paths (skip static assets, _next, etc.)
export const config = {
  matcher: [
    // Match all API routes
    "/api/:path*",
    // Match pages (but not static files)
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.gif|.*\\.ico).*)",
  ],
};
