# Library Modules Reference

Every module in `lib/`. These hold the domain logic and shared utilities. Source
of truth is the code — correct this file if it drifts.

---

## Domain / core

| Module | Responsibility |
|--------|----------------|
| `vedic-calculator.js` | Core astronomical engine. `astronomy-engine` + Lahiri ayanamsa. Computes planetary positions (7 planets + Rahu/Ketu), Lagna/Ascendant, Nakshatra + Pada, Navamsa (D9), Vimshottari Dasha timeline with real dates, dignities, Manglik dosha, classical yogas (Kaal Sarp, Budhaditya, Gajakesari, Pancha Mahapurusha, Neecha Bhanga…), and the North Indian Kundli SVG. **Timezone-aware:** accepts `timezoneOffsetMinutes`, LMT fallback from longitude, India bounding-box auto-IST. |
| `report-generation.js` | Builds the Gemini prompt (injects computed chart as hard facts) and generates the full report in batches to avoid truncation/timeout. Quality gate on section count. |
| `deep-dive.js` | Master-tier generation: 7 concern-specific deep-dive sections + 24-month roadmap. Kept separate so no single Gemini call risks the 60s timeout. |
| `email-sequence.js` | `generateEmailDrafts()` — ONE Gemini call → 10 psychology-based nurture emails as a JSON array. |

## Payments

| Module | Responsibility |
|--------|----------------|
| `fulfill-payment.js` | Idempotent `fulfillPayment()`. The single funnel for marking paid + generating + emailing, called by browser/webhook/reconcile paths. Handles the atomic-claim handoff and holds the Master email until deep-dive completes. |
| `plans.js` | Server-side plan/tier/price definitions (essential/premium/master + guidance). The source of truth for pricing — never trust client amounts. |

## Infrastructure / utilities

| Module | Responsibility |
|--------|----------------|
| `auth.js` | Timing-safe auth verification: `verifyAdmin()`, `verifyCron()`, `verifyInternal()`, `getInternalAuthHeaders()`. Fail-closed if a secret is unset. |
| `rate-limit.js` | Supabase-backed persistent rate limiter (cross-instance) + in-memory burst guard. Pre-configured limiters: `previewLimiter` (3/min), `paymentLimiter` (5/min), `saveLimiter` (10/min), `trackingLimiter` (30/min), `emailGenLimiter` (2/min). Fails open on DB outage. |
| `gemini-retry.js` | `generateWithRetry()` — retries Gemini 503s with exponential backoff (2s/4s/8s, max 3). |
| `geocode.js` | Geocodes a place string → lat/lng via **OpenStreetMap Nominatim** (free, no key). Indian-city fallbacks; returns a timezone offset for the calculator. |
| `sanitize.js` | Prompt-injection prevention (`sanitizeForPrompt`, 16 patterns), `sanitizeName`/`sanitizePlace`, and `sanitizeForHtml` (entity encoding for email output). |
| `markdown.js` | Converts AI markdown → safe HTML for report/email rendering. |
| `report-access.js` | Report access / share-token helpers. |
| `schema.js` | Schema.org JSON-LD builders (Organization, WebSite, Service, Product+AggregateRating, breadcrumb, article) + `JsonLd` component. |

## Content

| Module | Responsibility |
|--------|----------------|
| `blog-posts.js` | Static, hand-written SEO article library. |
| `blog-db.js` | Fetches AI-generated blog posts from Supabase `blog_posts`. Graceful `[]` fallback if the table is missing. |

## Supabase clients

| Module | Responsibility |
|--------|----------------|
| `supabase-browser.js` | Browser-side client (auth operations). |
| `supabase-server.js` | Server-side client (cookies/SSR). |
| `supabase-service.js` | Service-role client (bypasses RLS). Used by cron/admin/server code only — never exposed to the browser. |

*Last updated: September 2026*
