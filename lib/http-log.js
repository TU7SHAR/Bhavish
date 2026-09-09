/**
 * Per-request HTTP logging → Supabase `http_logs`.
 *
 * EDGE-SAFE BY DESIGN: this is imported by `proxy.js`, which runs on the Edge
 * runtime. It therefore uses raw `fetch` against Supabase's REST endpoint rather
 * than `@supabase/supabase-js`, for two reasons:
 *   1. Edge bundles have a size limit and the JS client is heavy.
 *   2. One HTTP POST is all we need for an insert.
 *
 * NEVER BLOCKS THE RESPONSE: callers pass this to `event.waitUntil()`, so the
 * insert happens after the response has been sent. A logging round-trip must
 * never be added to the user's time-to-first-byte — this site's conversion
 * problem is already sensitive to latency.
 *
 * KILL SWITCH: set HTTP_LOG_ENABLED=false to turn it off instantly without a
 * code change (env var + redeploy).
 */

// Paths that would add noise without adding insight.
const IGNORED_PATH_PATTERNS = [
  /^\/_next\//,
  /^\/favicon/,
  /\.(?:png|jpe?g|svg|gif|ico|webp|woff2?|ttf|map|txt|xml)$/i,
  // Our own log-reading endpoints — otherwise reading logs creates logs.
  /^\/api\/admin\/logs/,
  /^\/api\/admin\/http-logs/,
];

export function shouldLogPath(path) {
  if (!path) return false;
  return !IGNORED_PATH_PATTERNS.some((re) => re.test(path));
}

function deviceFromUA(ua = "") {
  if (/bot|crawler|spider|crawling|facebookexternalhit|bingpreview/i.test(ua)) return "bot";
  if (/iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  if (/ipad|android(?!.*mobile)|tablet/i.test(ua)) return "tablet";
  if (!ua) return "unknown";
  return "desktop";
}

/**
 * Insert one HTTP log row. Resolves to true/false; never throws.
 *
 * @param {Object} p
 * @param {string} p.method
 * @param {string} p.path
 * @param {number} [p.status]        - omit when genuinely unknown
 * @param {number} [p.durationMs]
 * @param {string} [p.source]        - 'proxy' | 'not-found' | 'route'
 * @param {string} [p.userAgent]
 * @param {string} [p.referrer]
 * @param {string} [p.country]
 * @param {Object} [p.meta]
 */
export async function logHttp({
  method,
  path,
  status,
  durationMs,
  source = "proxy",
  userAgent,
  referrer,
  country,
  meta,
} = {}) {
  try {
    if (process.env.HTTP_LOG_ENABLED === "false") return false;
    if (!method || !path) return false;
    if (!shouldLogPath(path)) return false;

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!baseUrl || !key) return false;

    const res = await fetch(`${baseUrl}/rest/v1/http_logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
        // Don't ask Postgres to send the row back — we don't need it.
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        method,
        path: String(path).slice(0, 500),
        status: typeof status === "number" ? status : null,
        duration_ms: typeof durationMs === "number" ? Math.round(durationMs) : null,
        source,
        device: deviceFromUA(userAgent),
        user_agent: userAgent ? String(userAgent).slice(0, 400) : null,
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        country: country || null,
        meta: meta && typeof meta === "object" ? meta : null,
      }),
    });

    return res.ok;
  } catch {
    // Table missing (migration 010 not run), network blip, anything — stay silent.
    return false;
  }
}

/**
 * Wrap a route handler so its real STATUS CODE and duration are recorded.
 *
 * The proxy cannot see response statuses (it runs before the response exists),
 * so this is the opt-in way to get them for routes worth measuring.
 *
 *   export const POST = withHttpLog(async (request) => { ... }, "/api/create-order");
 */
export function withHttpLog(handler, routeName) {
  return async function loggedHandler(request, ...rest) {
    const startedAt = Date.now();
    let status = 500;
    try {
      const response = await handler(request, ...rest);
      status = response?.status ?? 200;
      return response;
    } finally {
      const path = routeName || (() => {
        try { return new URL(request.url).pathname; } catch { return "unknown"; }
      })();
      // Fire-and-forget: awaiting would add latency to the API response.
      void logHttp({
        method: request?.method || "GET",
        path,
        status,
        durationMs: Date.now() - startedAt,
        source: "route",
        userAgent: request?.headers?.get?.("user-agent") || undefined,
        referrer: request?.headers?.get?.("referer") || undefined,
      });
    }
  };
}
