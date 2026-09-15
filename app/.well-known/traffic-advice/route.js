// Serves /.well-known/traffic-advice — the file Chrome's Private Prefetch Proxy
// requests to learn whether it may prefetch this site on the user's behalf.
//
// WHY: Chrome (and other Chromium browsers) can pre-load a site through a
// privacy-preserving proxy so the page feels instant when the user clicks. The
// proxy first fetches this file. If it's missing, the request 404s and Chrome
// falls back to its default (more conservative) behaviour. Serving a valid file
// with fraction 1.0 explicitly opts us in to 100% prefetching — a small,
// free page-speed win for Chrome users, which also helps Core Web Vitals.
//
// SPEC (Private Prefetch Proxy, "trafficadvice"):
//   - Path: /.well-known/traffic-advice
//   - Body: a JSON ARRAY of advice objects
//   - Content-Type: application/trafficadvice+json
//   - user_agent "prefetch-proxy" targets Chrome's proxy
//   - fraction 1.0 = allow prefetching 100% of the time (0.0 = disallow)
//
// Static + long cache: this value never changes, so it should be cached hard.

export const dynamic = "force-static";

const TRAFFIC_ADVICE = [
  {
    user_agent: "prefetch-proxy",
    google_prefetch_proxy_eap: {
      fraction: 1.0,
    },
    fraction: 1.0,
  },
];

export async function GET() {
  return new Response(JSON.stringify(TRAFFIC_ADVICE, null, 2), {
    status: 200,
    headers: {
      // The spec-defined content type. Chrome checks this; a generic
      // application/json is NOT accepted by the proxy.
      "Content-Type": "application/trafficadvice+json",
      // Never changes — cache aggressively at the edge and in the browser.
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}
