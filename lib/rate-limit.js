/**
 * Persistent rate limiter backed by Supabase.
 *
 * WHY THIS EXISTS (replacing the previous in-memory Map approach):
 * On Vercel serverless, each function instance has its own memory. The old
 * Map-based limiter was wiped on every cold start and not shared across
 * parallel instances — meaning an attacker could bypass it by waiting for
 * a new instance or sending concurrent requests that land on different
 * instances. This version uses the Supabase `rate_limits` table as a
 * shared counter store, so limits are enforced globally regardless of
 * which instance handles the request.
 *
 * PERFORMANCE: Adds ~20-50ms per request (one Supabase RPC call). This is
 * acceptable for the routes we rate-limit (AI generation at 3 req/min,
 * payments at 5 req/min) where the operations themselves take 2-60 seconds.
 *
 * FALLBACK: If Supabase is unreachable (network blip), we ALLOW the request
 * (fail-open for the rate limiter specifically) rather than blocking legitimate
 * users. The in-memory Map is kept as a secondary local guard for burst
 * protection even during DB outages.
 *
 * TABLE REQUIRED (run once in Supabase SQL editor):
 * ─────────────────────────────────────────────────
 *   CREATE TABLE IF NOT EXISTS rate_limits (
 *     key TEXT PRIMARY KEY,
 *     count INTEGER NOT NULL DEFAULT 1,
 *     window_start TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *
 *   -- Auto-cleanup: delete rows older than 2 hours (runs every hour)
 *   -- Supabase pg_cron or a Vercel cron can handle this, or the table
 *   -- stays small enough (~few hundred rows) that it doesn't matter.
 *   CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
 * ─────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

// Lazy-init Supabase client (service role for direct table access)
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }
  return _supabase;
}

// ─── In-memory fallback (burst guard + DB-unreachable safety net) ───
const localStore = new Map();
const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function localCleanup(windowMs) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, record] of localStore.entries()) {
    if (now - record.windowStart > windowMs * 2) {
      localStore.delete(key);
    }
  }
}

function checkLocal(key, maxRequests, windowMs) {
  localCleanup(windowMs);
  const now = Date.now();
  let record = localStore.get(key);

  if (!record || now - record.windowStart > windowMs) {
    record = { windowStart: now, count: 1 };
    localStore.set(key, record);
    return { allowed: true, remaining: maxRequests - 1 };
  }

  record.count++;
  if (record.count > maxRequests) {
    const retryAfterMs = windowMs - (now - record.windowStart);
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  return { allowed: true, remaining: maxRequests - record.count };
}

// ─── Main rate limit factory ───

/**
 * Creates a rate limiter with specified limits.
 * Uses Supabase for persistent cross-instance enforcement, with an in-memory
 * fallback for burst protection and resilience during DB outages.
 *
 * @param {Object} options
 * @param {number} options.maxRequests - Max requests allowed in the window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} options.prefix - Unique prefix to separate different limiters
 * @returns {Function} - Rate limit checker function
 *
 * Usage:
 *   const limiter = createRateLimit({ maxRequests: 5, windowMs: 60000, prefix: 'preview' });
 *   const result = await limiter(request);  // NOTE: now async!
 *   if (!result.allowed) return NextResponse.json({ error: result.error }, { status: 429 });
 */
export function createRateLimit({ maxRequests = 10, windowMs = 60000, prefix = "global" } = {}) {
  return async function checkRateLimit(request) {
    // Extract IP from various headers (Vercel, Cloudflare, standard)
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown";

    const key = `${prefix}:${ip}`;

    // 1. Local burst guard (immediate, no network call)
    const localResult = checkLocal(key, maxRequests, windowMs);
    if (!localResult.allowed) {
      return {
        allowed: false,
        remaining: 0,
        ip,
        retryAfter: localResult.retryAfterSec,
        error: `Too many requests. Please try again in ${localResult.retryAfterSec} seconds.`,
      };
    }

    // 2. Supabase persistent check (cross-instance enforcement)
    try {
      const supabase = getSupabase();
      const windowStart = new Date(Date.now() - windowMs).toISOString();

      // Upsert: increment count if within window, or reset if window expired.
      // Uses a single atomic operation to prevent race conditions.
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_key: key,
        p_max_requests: maxRequests,
        p_window_ms: windowMs,
      });

      if (error) {
        // If the RPC doesn't exist yet (table not migrated), fall back to
        // a simple select+upsert approach.
        if (error.message?.includes("function") || error.code === "42883") {
          return await fallbackDbCheck(supabase, key, maxRequests, windowMs, ip);
        }
        // DB unreachable — fail open (local guard already passed)
        console.warn("[rate-limit] Supabase error, allowing request:", error.message);
        return { allowed: true, remaining: localResult.remaining, ip };
      }

      // RPC returns { allowed: boolean, current_count: number }
      if (data && !data.allowed) {
        const retryAfterSec = Math.ceil(windowMs / 1000);
        return {
          allowed: false,
          remaining: 0,
          ip,
          retryAfter: retryAfterSec,
          error: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        };
      }

      const remaining = Math.max(0, maxRequests - (data?.current_count || 1));
      return { allowed: true, remaining, ip };
    } catch (err) {
      // Network failure — fail open (local guard already passed)
      console.warn("[rate-limit] Exception, allowing request:", err.message);
      return { allowed: true, remaining: localResult.remaining, ip };
    }
  };
}

/**
 * Fallback for when the RPC function doesn't exist yet.
 * Uses simple SELECT + UPSERT with the rate_limits table directly.
 */
async function fallbackDbCheck(supabase, key, maxRequests, windowMs, ip) {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  // Try to read existing record
  const { data: existing } = await supabase
    .from("rate_limits")
    .select("count, window_start")
    .eq("key", key)
    .single();

  if (!existing || new Date(existing.window_start) < windowStart) {
    // No record or expired window — reset
    await supabase
      .from("rate_limits")
      .upsert({ key, count: 1, window_start: now.toISOString() }, { onConflict: "key" });
    return { allowed: true, remaining: maxRequests - 1, ip };
  }

  // Within window — increment
  const newCount = (existing.count || 0) + 1;
  await supabase
    .from("rate_limits")
    .update({ count: newCount })
    .eq("key", key);

  if (newCount > maxRequests) {
    const retryAfterSec = Math.ceil(windowMs / 1000);
    return {
      allowed: false,
      remaining: 0,
      ip,
      retryAfter: retryAfterSec,
      error: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
    };
  }

  return { allowed: true, remaining: maxRequests - newCount, ip };
}

/**
 * Pre-configured rate limiters for different route types.
 * NOTE: These are now ASYNC — callers must await them.
 *
 * Migration: change `const result = limiter(request)` to
 *            `const result = await limiter(request)` in API routes.
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
