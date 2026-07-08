/**
 * In-memory rate limiter for Vercel serverless functions.
 * Uses a sliding window approach with automatic cleanup.
 * 
 * NOTE: On Vercel, each serverless function instance has its own memory,
 * so this provides per-instance rate limiting. For production at scale,
 * consider Upstash Redis (@upstash/ratelimit). This is still effective
 * because Vercel reuses warm instances for consecutive requests.
 */

const rateLimitStore = new Map();

// Clean up expired entries every 60 seconds to prevent memory leaks
const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Creates a rate limiter with specified limits.
 * 
 * @param {Object} options
 * @param {number} options.maxRequests - Max requests allowed in the window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.prefix - Unique prefix to separate different limiters
 * @returns {Function} - Rate limit checker function
 * 
 * Usage:
 *   const limiter = createRateLimit({ maxRequests: 5, windowMs: 60000, prefix: 'preview' });
 *   const result = limiter(request);
 *   if (!result.allowed) return NextResponse.json({ error: result.error }, { status: 429 });
 */
export function createRateLimit({ maxRequests = 10, windowMs = 60000, prefix = "global" } = {}) {
  return function checkRateLimit(request) {
    cleanup(windowMs);

    // Extract IP from various headers (Vercel, Cloudflare, standard)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const key = `${prefix}:${ip}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now - record.windowStart > windowMs) {
      // New window
      record = { windowStart: now, count: 1 };
      rateLimitStore.set(key, record);
      return { allowed: true, remaining: maxRequests - 1, ip };
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfterMs = windowMs - (now - record.windowStart);
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return {
        allowed: false,
        remaining: 0,
        ip,
        retryAfter: retryAfterSec,
        error: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
      };
    }

    return { allowed: true, remaining: maxRequests - record.count, ip };
  };
}

/**
 * Pre-configured rate limiters for different route types.
 * Adjust these based on expected traffic patterns.
 */

// Public AI generation routes (expensive - Gemini tokens)
// 3 requests per minute per IP — generous for legitimate use, blocks spam
export const previewLimiter = createRateLimit({
  maxRequests: 3,
  windowMs: 60 * 1000,
  prefix: "preview",
});

// Payment routes — slightly more generous (user might retry)
// 5 requests per minute per IP
export const paymentLimiter = createRateLimit({
  maxRequests: 5,
  windowMs: 60 * 1000,
  prefix: "payment",
});

// Save/data routes — moderate
// 10 requests per minute per IP
export const saveLimiter = createRateLimit({
  maxRequests: 10,
  windowMs: 60 * 1000,
  prefix: "save",
});

// Tracking pixel — lenient (email clients may load multiple times)
// 30 requests per minute per IP
export const trackingLimiter = createRateLimit({
  maxRequests: 30,
  windowMs: 60 * 1000,
  prefix: "tracking",
});

// Email sequence generation (AI-heavy, called once per lead)
// 2 requests per minute per IP
export const emailGenLimiter = createRateLimit({
  maxRequests: 2,
  windowMs: 60 * 1000,
  prefix: "emailgen",
});
