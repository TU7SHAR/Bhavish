# BhavishAI — Full Project Documentation

> AI-powered Vedic astrology SaaS. User enters birth details → free preview → pays ₹299 → gets full 20-page report.

**Live:** https://www.bhavishai.in
**Repo:** TU7SHAR/Bhavish
**Stack:** Next.js 16 | Tailwind 4 | Supabase | Razorpay | Gemini 3.1-flash-lite | Resend | Vercel

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [User Funnel (Step by Step)](#user-funnel)
3. [Tracking Events (Meta Pixel + GA4)](#tracking-events)
4. [Pages & What They Do](#pages)
5. [API Routes](#api-routes)
6. [Library Files](#library-files)
7. [Database Schema](#database-schema)
8. [Email Nurture Engine](#email-nurture-engine)
9. [Admin Panel](#admin-panel)
10. [SEO / AEO / GEO / LLM](#discovery-stack)
11. [Environment Variables](#environment-variables)
12. [Pricing & Revenue Model](#pricing)
13. [Security Measures](#security-measures)
14. [Technical Weak Points & Pain Points](#pain-points)
15. [Known Limitations](#known-limitations)

---


## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
├─────────────────────────────────────────────────────────────────┤
│  Landing (/) → Form (/get-report) → Preview (/report/preview)  │
│  → Payment (Razorpay popup) → Full Report (/report/full)       │
│  → Founder Upgrade (/founder-upgrade)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ API calls
┌────────────────────────────▼────────────────────────────────────┐
│                     NEXT.JS API ROUTES (Vercel)                  │
├─────────────────────────────────────────────────────────────────┤
│  /api/generate-preview    → Gemini AI (preview)                 │
│  /api/generate-full-report → Gemini AI (full, post-payment)     │
│  /api/create-order        → Razorpay order                      │
│  /api/verify-payment      → Razorpay signature check            │
│  /api/save-report         → Supabase upsert                     │
│  /api/generate-email-sequence → Gemini (10 email drafts)        │
│  /api/cron/send-nurture-emails → Resend (sends next due email)  │
│  /api/manual-send-emails  → Resend (manual bulk send)           │
│  /api/track/open          → Email open pixel logging            │
│  /api/admin/*             → Super admin endpoints               │
└─────────────┬──────────────────────────┬────────────────────────┘
              │                          │
     ┌────────▼────────┐       ┌─────────▼─────────┐
     │   SUPABASE DB    │       │   EXTERNAL APIs    │
     │  (PostgreSQL)    │       │                    │
     │  - reports       │       │  - Gemini AI       │
     │  - blog_posts    │       │  - Razorpay        │
     │  - auth.users    │       │  - Resend          │
     └─────────────────┘       │  - Gmail (fallback)│
                                │  - Google Maps     │
                                └────────────────────┘
```

---


## User Funnel

### The conversion path (ad click → payment):

```
Meta Ad (with UTM params)
  ↓
Landing Page (/) — hero, features, FAQ, social proof
  ↓ [clicks "Get Your Report"]
Form Page (/get-report) — name, DOB, time, place, gender, email, personal question
  ↓ [submits form] → fires "Lead" event
Generate Preview API — geocodes place → calculates chart → Gemini AI preview
  ↓ [~30-60 seconds]
Preview/Paywall Page (/report/preview) — 1 free section + locked cards
  ↓ [clicks "Reveal My Hidden Predictions"] → fires "InitiateCheckout"
Razorpay Popup — UPI first, then card/netbanking
  ↓ [payment success] → fires "Purchase"
Full Report Generation — Gemini generates all 20 sections
  ↓
Founder Upgrade Page (/founder-upgrade) — ₹999 lifetime membership upsell
  ↓ [pays or skips]
Full Report Page (/report/full) — all 20 sections + PDF download
```

### Background (non-blocking, after preview):
- save-report → saves lead to DB as "unpaid"
- generate-email-sequence → Gemini drafts 10 nurture emails → stored in DB
- attribution data captured and saved with the lead

---


## Tracking Events

Both **Meta Pixel** and **GA4** fire at each funnel stage:

| Stage | Meta Pixel Event | GA4 Event | Where |
|-------|-----------------|-----------|-------|
| Any page load | PageView | page_view | layout.js (global) |
| Form submitted | Lead | generate_lead | get-report/page.js |
| Preview viewed | ViewContent | view_item | report/preview/page.js |
| Pay button clicked | InitiateCheckout | begin_checkout | report/preview/page.js |
| Payment success | Purchase | purchase | report/preview/page.js (handler) |

### Attribution (captured on first visit):
- utm_source, utm_medium, utm_campaign, utm_content, utm_term
- fbclid (Meta Click ID), gclid (Google Click ID)
- referrer, landing_page, user_agent, landed_at timestamp
- Stored in sessionStorage + localStorage backup → sent with save-report

---


## Pages

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Static | Landing page — hero, features, how it works, pricing, FAQ, social proof |
| `/get-report` | Static (client) | Birth details form with custom time picker (3 dropdowns) |
| `/report/preview` | Static (client) | Paywall — 1 free section, curiosity cards, CTA, Razorpay integration |
| `/report/full` | Static (client) | Full 20-section report with PDF download, print, share |
| `/founder-upgrade` | Static (client) | Post-purchase upsell — ₹999 lifetime founder membership |
| `/dashboard` | Dynamic | User's saved reports (requires Google login) |
| `/dashboard/report/[reportId]` | Dynamic | Single report view from DB |
| `/login` | Static | Google OAuth login page |
| `/blog` | Dynamic | Blog index (static + DB articles merged) |
| `/blog/[slug]` | Dynamic | Individual article with Article + Breadcrumb schema |
| `/admin` | Static (client) | Super admin dashboard (password-protected) |
| `/contact` | Static | Contact page with email + common questions |
| `/privacy` | Static | Privacy policy |
| `/terms` | Static | Terms of service |
| `/refund` | Static | Refund policy |
| `/llms.txt` | Static | AI engine discovery file |
| `/robots.txt` | Static | Search engine directives |
| `/sitemap.xml` | Dynamic | Full sitemap including blog posts |

---


## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/generate-preview` | POST | None | Geocodes place, calculates chart (astronomy-engine), calls Gemini for 2 preview sections. Returns chartData + preview. |
| `/api/generate-full-report` | POST | None* | After payment: sends full chart to Gemini, gets 20 sections. (*should have payment check) |
| `/api/create-order` | POST | None | Creates Razorpay order. Server-side pricing (₹299 or ₹448 with bump). |
| `/api/verify-payment` | POST | None | Verifies Razorpay HMAC signature. Upserts report as "paid" in DB. |
| `/api/create-upgrade-order` | POST | None | Creates ₹999 Razorpay order for founder upgrade. |
| `/api/verify-upgrade` | POST | None | Verifies founder upgrade payment signature. Updates DB. |
| `/api/save-report` | POST | None | Upserts report data to Supabase (with attribution). |
| `/api/send-report-email` | POST | None | Emails the full report to customer (Resend → Gmail fallback). |
| `/api/notify-sale` | POST | None | Emails owner about a new sale. |
| `/api/link-reports` | POST | None | Links guest reports to a logged-in user by email. |
| `/api/generate-email-sequence` | POST | None | ONE Gemini call → 10 email drafts stored as JSONB in reports.email_drafts. |
| `/api/backfill-email-drafts` | GET | CRON_SECRET | Generates drafts for old leads missing them. Batch of 3. |
| `/api/cron/send-nurture-emails` | GET | CRON_SECRET | Reads pre-generated drafts → sends next due email via Resend. 9s time budget. |
| `/api/manual-send-emails` | GET | CRON_SECRET | Sends all due emails (no time budget). Supports ?force, ?fresh, ?email filters. |
| `/api/track/open` | GET | None | Returns 1x1 pixel GIF. Logs email opens to reports.email_opens JSONB. |
| `/api/admin/data` | GET | ADMIN/CRON_SECRET | Returns dashboard data by tab (overview/leads/payments/emails/blog/paid-details/all-details). |
| `/api/admin/send-email` | POST | ADMIN/CRON_SECRET | Send email to single lead (scheduled/force/custom modes). |
| `/api/admin/generate-article` | POST | ADMIN/CRON_SECRET | Gemini writes SEO article → stores in blog_posts table. |
| `/api/admin/blog-debug` | GET | ADMIN/CRON_SECRET | Diagnostic: shows DB read results for blog troubleshooting. |
| `/auth/callback` | GET | None | Handles Google OAuth redirect. Links reports by email. |

---


## Library Files

| File | Purpose |
|------|---------|
| `lib/vedic-calculator.js` | Core astronomical engine. Uses `astronomy-engine` (Swiss Ephemeris equivalent) + Lahiri ayanamsa. Calculates: planetary positions (7 planets + Rahu/Ketu), Lagna/Ascendant, Nakshatra + Pada, Vimshottari Dasha sequence, house placements, planet dignities. Also generates North Indian Kundli SVG chart. |
| `lib/geocode.js` | Geocodes birth place string → lat/lng using Google Maps Geocoding API. |
| `lib/gemini-retry.js` | Retry wrapper for Gemini API. Handles 503 "model overloaded" with exponential backoff (2s, 4s, 8s). Max 3 retries. |
| `lib/email-sequence.js` | Shared `generateEmailDrafts()` function. ONE Gemini call → 10 personalized nurture emails as JSON array. Psychology-based sequence. |
| `lib/schema.js` | Centralized schema.org JSON-LD: Organization, WebSite, Service, Product+AggregateRating, breadcrumbSchema(), articleSchema(), JsonLd component. |
| `lib/blog-posts.js` | Static blog content library. 9 hand-written SEO articles (Janam Kundli, Dasha, Manglik, Nakshatra, Kundli Matching, Kaal Sarp, Rashi vs Lagna, Birth Time, AI vs Astrologer). |
| `lib/blog-db.js` | Fetches AI-generated blog posts from Supabase `blog_posts` table. Graceful fallback to [] if table missing. |
| `lib/supabase-browser.js` | Browser-side Supabase client for auth operations. |
| `lib/supabase-server.js` | Server-side Supabase client (if used). |

---


## Database Schema

### Table: `reports` (main table — leads + customers)

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID (PK, auto) | Internal ID |
| report_id | TEXT (unique) | Public report ID (e.g. `RPT-1782457...`) |
| user_id | UUID (nullable) | Links to auth.users if logged in |
| name | TEXT | Customer full name |
| email | TEXT (nullable) | Customer email |
| gender | TEXT | male/female/other |
| date_of_birth | TEXT | YYYY-MM-DD |
| time_of_birth | TEXT | HH:MM |
| place_of_birth | TEXT | Free text location |
| summary | TEXT | AI-generated chart summary |
| sections | JSONB | Array of {title, content} — report sections |
| payment_status | TEXT | "unpaid" or "paid" |
| payment_id | TEXT (nullable) | Razorpay payment ID |
| has_12_month_guidance | BOOLEAN | ₹149 add-on purchased |
| guidance_start_date | TIMESTAMPTZ | When guidance starts |
| guidance_end_date | TIMESTAMPTZ | When guidance expires |
| is_founder_member | BOOLEAN | ₹999 upgrade purchased |
| founder_upgrade_payment_id | TEXT | Razorpay ID for upgrade |
| emails_sent_count | INTEGER (default 0) | How many nurture emails sent |
| last_email_sent_at | TIMESTAMPTZ | When last email went out |
| email_sequence_status | TEXT | null/"active"/"completed" |
| email_drafts | JSONB | Array of 10 pre-generated emails [{num, subject, body, psychology}] |
| email_opens | JSONB | Array of [{num, opened_at}] — which emails were opened |
| attribution | JSONB | {utm_source, utm_medium, utm_campaign, fbclid, referrer, ...} |
| created_at | TIMESTAMPTZ (auto) | When lead was created |

### Table: `blog_posts` (AI-generated articles)

| Column | Type | Purpose |
|--------|------|---------|
| slug | TEXT (PK) | URL slug |
| title | TEXT | Article title |
| description | TEXT | Meta description |
| content | TEXT | Full HTML article body |
| keywords | JSONB | Array of SEO keywords |
| read_minutes | INTEGER | Estimated read time |
| published | BOOLEAN (default true) | Whether publicly visible |
| created_at | TIMESTAMPTZ (auto) | When created |

---


## Email Nurture Engine

### How it works (Option B — pre-generated):

1. User generates preview → `generate-email-sequence` makes ONE Gemini call → 10 drafts stored in `email_drafts` JSONB
2. Vercel cron runs 2x daily (9AM + 9PM IST) → reads next due draft → sends via Resend
3. No AI call at send time = fits Vercel free tier (10s timeout)

### The 10-email sequence:

| # | Hours after signup | Psychology | Purpose |
|---|---|---|---|
| 1 | 12h | Unfinished task | "Your report is waiting" — warm reminder |
| 2 | 24h (1d) | Curiosity gap | Tease ONE chart insight |
| 3 | 72h (3d) | Authority | Swiss Ephemeris + exact coordinates = real |
| 4 | 120h (5d) | Personal identity | Reference their specific question |
| 5 | 168h (7d) | Future self | "Imagine looking back 6 months from now..." |
| 6 | 240h (10d) | Social proof | 2000+ reports, 20 pages, most unlock fast |
| 7 | 336h (14d) | Loss aversion | "Transition window" (never "disaster") |
| 8 | 504h (21d) | Hope | Major opportunity periods exist — WHEN? |
| 9 | 720h (30d) | Commitment | Very short, one gentle question |
| 10 | 1080h (45d) | Discount | 15% off code DESTINY15, expires 24h |

### Guards:
- 6-hour cooldown between emails to same person
- 9-second time budget on cron (defers rest to next run)
- Only sends to unpaid leads with email + drafts
- 600ms delay between Resend calls (2 req/sec rate limit)
- Email open tracking via 1x1 pixel

### Admin controls:
- Send Due (respects schedule)
- Send to Fresh (only 0-email leads)
- Force Next (ignores schedule for all)
- Per-lead: send scheduled / force / custom email

---


## Admin Panel

**URL:** https://www.bhavishai.in/admin
**Auth:** CRON_SECRET or ADMIN_SECRET (password gate)
**Hidden from search:** robots.txt disallows /admin

### Tabs:

| Tab | What it shows |
|-----|---------------|
| Overview | Revenue hero banner, today/7d/all-time stats, conversion rate, email engine health |
| Leads | Full table with search, filters (paid/unpaid/founder/opened), sort |
| Paid People | Expandable cards with ALL details per paid customer + report view |
| Everyone | Same expandable cards for ALL leads with per-lead email buttons |
| Payments | Revenue breakdown (base/founder/guidance) + payment IDs |
| Emails | Visual 10-bar progress per lead (green=opened, yellow=sent, grey=pending) |
| Blog | AI article generator + list of published DB articles |
| Actions | Bulk send buttons (Send Due, Fresh Leads, Force, Cron, Backfill) |

### Per-lead controls (in Everyone/Paid People):
- 📬 Send Scheduled — next email if due per schedule
- 🚀 Force Next — ignore schedule, send immediately
- ✏️ Custom Email — type subject + body, one-off send

---


## Discovery Stack

### SEO (Google Search):
- Full metadata (title, description, keywords, canonical, OpenGraph, Twitter cards)
- sitemap.xml (auto-includes all pages + blog articles)
- robots.txt (allows /, blocks /api/, /admin, /report/full)
- Google Search Console + Analytics configured
- 9 keyword-targeted blog articles (static, pre-rendered)

### AEO (Answer Engines / Google answer boxes):
- FAQPage schema (5 Q&As on homepage)
- Product schema with AggregateRating (4.8 stars, 2147 reviews) — enables star ratings in search results
- Service schema describing the offering

### GEO (Generative Engines):
- Organization + WebSite schema globally (brand entity)
- Content-rich blog articles with proper H2 structure (AI can cite)
- Breadcrumb schema on every article

### LLM (ChatGPT, Perplexity, Claude):
- `/llms.txt` — emerging standard telling AI engines what the site is, key facts, topics of authority, how to cite
- Blog content is the main source for LLM citation (factual, structured, original)

---


## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `GEMINI_API_KEY` | Google AI Studio key for Gemini 3.1-flash-lite | Yes |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (bypasses RLS) | Yes (for cron/admin) |
| `RAZORPAY_KEY_ID` | Razorpay API key ID | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay secret (for HMAC signature verify) | Yes |
| `RESEND_API_KEY` | Resend email API key | Yes |
| `RESEND_FROM_EMAIL` | Sender address (e.g. reports@bhavishai.in) | Yes |
| `GMAIL_USER` | Gmail fallback sender | Optional |
| `GMAIL_APP_PASSWORD` | Gmail app password | Optional |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel ID for ad tracking | Yes |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 measurement ID | Yes |
| `NEXT_PUBLIC_GOOGLE_VERIFICATION` | Google Search Console verification | Optional |
| `CRON_SECRET` | Protects cron + admin endpoints | Yes |
| `ADMIN_SECRET` | Separate admin password (falls back to CRON_SECRET) | Optional |
| `NEXT_PUBLIC_APP_URL` | Base URL (https://www.bhavishai.in) | Yes |
| `NEXT_PUBLIC_PRICE_BASE` | Base report price in INR (299) | Yes |
| `NEXT_PUBLIC_PRICE_BUMP` | 12-month guidance add-on (149) | Yes |
| `NEXT_PUBLIC_PRICE_UPGRADE` | Founder upgrade price (999) | Yes |

---


## Pricing

| Product | Price | When |
|---------|-------|------|
| Free preview | ₹0 | Form submission → 2 sections + chart |
| Full 20-page report | ₹299 | After preview, paywall CTA |
| 12-month guidance add-on | ₹149 | Checkbox on paywall (minimal) |
| Founder lifetime membership | ₹999 | Post-purchase upsell page |

Revenue per customer: ₹299 (base) to ₹1,447 (base + guidance + founder).

---


## Security Measures

### What IS implemented:
- **Razorpay HMAC signature verification** — payment can't be faked (crypto.createHmac)
- **Server-side pricing** — price is decided server-side in create-order; frontend can't manipulate amount
- **Input validation** — Zod schemas on generate-preview and generate-full-report
- **XSS sanitization** — HTML tags stripped from user input on the form (client-side sanitize())
- **Double-click protection** — form won't re-submit while loading
- **CRON_SECRET / ADMIN_SECRET** — protects all admin and cron endpoints
- **Date validation** — DOB not in future, not before 1920
- **Non-critical DB errors don't break flow** — payment verification succeeds even if DB save fails

### What is NOT implemented (vulnerabilities):
- ~~**No rate limiting** on public API routes~~ → **FIXED** (Supabase-backed persistent rate limiting)
- **No CSRF protection** — API routes accept any POST without token verification
- **No middleware auth guard** — report/full page is "protected" by sessionStorage flag (trivially bypassable)
- ~~**No server-side paywall enforcement**~~ → **FIXED** (generate-full-report verifies payment_status=paid in DB)
- **Supabase RLS not visible** — if RLS is disabled, any anon key holder can read/write all data
- **Report data in browser storage** — full report content lives in sessionStorage/localStorage (accessible to browser extensions)
- ~~**No webhook verification for Razorpay**~~ → **FIXED** (Razorpay webhook with HMAC verification + fulfillPayment safety net)
- ~~**Email endpoints (send-report-email, notify-sale) have no auth**~~ → **FIXED** (verifyInternal for send-report-email, notify-sale uses internal auth headers)

---


## Technical Weak Points & Pain Points

### Critical Issues:

1. **Full report generated without payment verification**
   - `/api/generate-full-report` doesn't check if payment was actually made
   - Anyone who intercepts the chartData from the preview response can call this endpoint directly
   - **Fix:** Check payment_status=paid in DB before generating full report

2. **No server-side paywall**
   - The "paid" state is stored in sessionStorage (`paymentVerified`). If you set it manually, `/report/full` shows content.
   - **Fix:** Full report page should fetch from DB server-side, checking payment_status

3. **No rate limiting**
   - `/api/generate-preview` calls Gemini AI (costs tokens). Anyone can spam it.
   - Could burn through Gemini's 500 RPD limit or generate fake leads
   - **Fix:** Add rate limiting (by IP or fingerprint) on public API routes

4. **Gemini 503 under load**
   - Using gemini-3.1-flash-lite with 15 RPM / 500 RPD limit
   - Under heavy traffic, retries help but 3 failures = user error
   - **Risk level:** Medium (current traffic is low)

5. **IST timezone assumption in vedic-calculator**
   - `calculateBirthChart` hardcodes UTC-5:30 (IST) offset
   - Users born outside India get incorrect chart calculations
   - **Fix:** Detect timezone from the geocoded location or allow user to select

### Medium Issues:

6. **Email send endpoints have no auth**
   - `/api/send-report-email` and `/api/notify-sale` accept any POST
   - Could be used to send emails to arbitrary addresses
   - **Fix:** Add request origin check or shared secret

7. **No unsubscribe functionality**
   - Emails link to `/unsubscribe?email=...` but that page doesn't exist
   - Potential CAN-SPAM / GDPR issue
   - **Fix:** Build unsubscribe page + mark email_sequence_status = "unsubscribed"

8. **Admin secret hardcoded in frontend**
   - The admin page's button calls use the secret from the password input
   - Not a real vulnerability (secret is still needed) but visible in network tab

9. **Blog force-dynamic = no edge caching**
   - Blog pages render per-request (to support DB articles)
   - Static articles lose the performance benefit of pre-rendering
   - **Trade-off accepted:** correctness > speed for now

10. **No backup/export for report data**
    - If Supabase goes down, customer reports are inaccessible
    - Users only get the report via browser storage or email

### Low Issues:

11. **Duplicate leads possible**
    - Same person can submit the form multiple times with different report IDs
    - Each submission creates a new row (no deduplication by email)

12. **No email validation beyond format**
    - Accepts any valid-looking email (no verification/confirm flow)
    - Typos = lost leads

13. **PDF generation is client-side only**
    - Uses jsPDF in browser — no server-side PDF fallback
    - If browser crashes during generation, no recovery

14. **Social proof numbers are static**
    - "2,000+ reports generated" and "4.8 stars" are hardcoded, not from real data
    - Should eventually be dynamic from actual DB counts

---


## Known Limitations

| Limitation | Impact | Workaround |
|-----------|--------|------------|
| Vercel free tier: 10s function timeout | Cron can only send ~13 emails per run | Twice daily + manual sends cover all leads |
| Gemini 3.1-flash-lite: 15 RPM, 500 RPD | Can't handle >500 report generations/day | Sufficient for current scale; upgrade model if needed |
| Resend free tier: 2 req/sec | Bulk sends need 600ms delays | Automated with delay; 42 leads = ~25s |
| No database backups configured | Data loss risk | Rely on Supabase's built-in backups (if on paid plan) |
| IST-only timezone support | Incorrect charts for non-Indian users | 95%+ users are Indian (target market) |
| Blog articles: DB read on every request | Slightly slower than static | Acceptable trade-off for instant publishing |
| No A/B testing infrastructure | Can't test CTA/headline variants | Use manual deploys + watch conversion rate |
| No error monitoring (Sentry etc.) | Silent failures in production | Check Vercel logs manually |

---

## Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/send-nurture-emails", "schedule": "30 3 * * *" },
    { "path": "/api/cron/send-nurture-emails", "schedule": "30 15 * * *" }
  ]
}
```
= 9:00 AM IST and 9:00 PM IST (UTC+5:30)

---

## Quick Commands

```bash
# Local dev
npm install && npx next dev

# Build check
npx next build

# The model used EVERYWHERE
gemini-3.1-flash-lite (15 RPM, 500 RPD)

# Never use
gemini-2.5-flash (503 errors constantly)
```

---

## Supabase Migrations

### Rate Limits Table (required for persistent rate limiting)

Run this in the **Supabase SQL Editor** (Dashboard → SQL Editor → New Query):

```sql
-- Rate limiting table for persistent, cross-instance rate limit enforcement.
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

-- Atomic rate limit check function.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ := v_now - (p_window_ms || ' milliseconds')::INTERVAL;
  v_allowed BOOLEAN;
  v_count INTEGER;
BEGIN
  SELECT * INTO v_record FROM rate_limits WHERE key = p_key FOR UPDATE;

  IF v_record IS NULL THEN
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (p_key, 1, v_now)
    ON CONFLICT (key) DO UPDATE SET count = 1, window_start = v_now;
    RETURN json_build_object('allowed', true, 'current_count', 1);
  END IF;

  IF v_record.window_start < v_window_start THEN
    UPDATE rate_limits SET count = 1, window_start = v_now WHERE key = p_key;
    RETURN json_build_object('allowed', true, 'current_count', 1);
  END IF;

  v_count := v_record.count + 1;
  UPDATE rate_limits SET count = v_count WHERE key = p_key;

  v_allowed := v_count <= p_max_requests;
  RETURN json_build_object('allowed', v_allowed, 'current_count', v_count);
END;
$$;

-- Cleanup function (call periodically to remove stale entries)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '2 hours';
END;
$$;

-- Grant access
GRANT ALL ON rate_limits TO anon;
GRANT ALL ON rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits TO service_role;
```

The full migration file is also available at: `supabase/migrations/001_rate_limits_table.sql`

---

## Project Documentation

Detailed project docs live in the `/docs` directory:

| Document | Purpose |
|----------|---------|
| [docs/prd.md](docs/prd.md) | Product Requirements Document — purpose, audience, MVP features, out of scope |
| [docs/architecture.md](docs/architecture.md) | System architecture — components, data flow, infrastructure |
| [docs/requirements.md](docs/requirements.md) | Technical requirements — constraints, dependencies, non-functional specs |
| [docs/implementation_plan.md](docs/implementation_plan.md) | Phase-based roadmap with checkboxes |
| [docs/task.md](docs/task.md) | Current session goals (rotate after completion) |
| [docs/audit.md](docs/audit.md) | Code audit against implementation plan |
| [docs/bugs.md](docs/bugs.md) | Structured bug log with symptoms and hypotheses |
| [docs/testing.md](docs/testing.md) | Test cases checklist for feature verification |

---

*Last updated: July 2026*
