# Architecture Document

## BhavishAI — System Architecture

**Version:** 1.0
**Last Updated:** July 2026

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            CLIENT (Browser)                               │
│                                                                           │
│  Landing (/) → Form (/get-report) → Preview (/report/preview)           │
│  → Razorpay Popup → Full Report (/report/full)                          │
│  → Founder Upgrade (/founder-upgrade) → Dashboard (/dashboard)          │
│                                                                           │
│  [React 19 | Next.js 16 App Router | Tailwind 4 | Client Components]    │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTPS (Vercel Edge)
┌───────────────────────────────────▼─────────────────────────────────────┐
│                       VERCEL SERVERLESS (API Layer)                       │
│                                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Preview     │  │  Payment     │  │  Report Gen  │  │  Email      │ │
│  │  Generation  │  │  Processing  │  │  (Full)      │  │  Engine     │ │
│  │             │  │              │  │              │  │             │ │
│  │ geocode     │  │ create-order │  │ generate-    │  │ nurture     │ │
│  │ vedic-calc  │  │ verify-pay   │  │ full-report  │  │ cron send   │ │
│  │ gemini AI   │  │ webhook      │  │ fulfill-pay  │  │ email-seq   │ │
│  │ save-report │  │ reconcile    │  │ send-email   │  │ track/open  │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │                  │        │
└─────────┼─────────────────┼──────────────────┼──────────────────┼────────┘
          │                 │                  │                  │
          ▼                 ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                               │
│                                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────┐   │
│  │ Supabase   │  │ Razorpay   │  │ Gemini AI  │  │ Resend / Gmail │   │
│  │ PostgreSQL │  │ Payments   │  │ 3.1-flash  │  │ Email Delivery │   │
│  │ + Auth     │  │ + Webhook  │  │ -lite      │  │                │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────┘   │
│                                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                        │
│  │ Nominatim  │  │ Vercel     │  │ Meta Pixel │                        │
│  │ Geocoding  │  │ Analytics  │  │ + GA4      │                        │
│  └────────────┘  └────────────┘  └────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Frontend (Next.js App Router)

```
app/
├── layout.js              ← Root layout (fonts, analytics, pixels, schema.org)
├── page.js                ← Landing page (static, SEO-optimized)
├── get-report/page.js     ← Form (client component, validates input)
├── report/
│   ├── preview/page.js    ← Paywall (shows preview, handles Razorpay)
│   └── full/page.js       ← Full report display + PDF download
├── founder-upgrade/page.js ← Post-purchase upsell
├── dashboard/             ← User account (requires auth)
│   ├── page.js            ← Report list
│   └── report/[reportId]/ ← Single report from DB
├── blog/                  ← SEO content
│   ├── page.js            ← Blog index
│   └── [slug]/page.js     ← Individual article
├── admin/page.js          ← Admin dashboard (password-gated)
├── components/            ← Shared UI components
│   ├── Header.js
│   ├── Footer.js
│   ├── KundliCharts.js
│   ├── GuidancePack.js
│   ├── AttributionCapture.js
│   ├── VisitorTracker.js
│   └── ConstellationBackground.js
└── api/                   ← Serverless API routes (see §2.2)
```

**Key decisions:**
- All report pages are **client components** (need browser storage + interactivity)
- Blog pages are **server components** (SEO, static rendering)
- No middleware.js — auth is checked per-page/per-route
- Attribution captured via `sessionStorage` + `localStorage` backup

### 2.2 API Layer (Serverless Functions)

| Domain | Routes | Max Duration | Dependencies |
|--------|--------|-------------|-------------|
| **Preview Generation** | `/api/generate-preview` | 30s | Nominatim, astronomy-engine, Gemini |
| **Payment** | `/api/create-order`, `/api/verify-payment`, `/api/razorpay-webhook`, `/api/create-upgrade-order`, `/api/verify-upgrade` | 10-60s | Razorpay SDK |
| **Report** | `/api/generate-full-report`, `/api/save-report`, `/api/generate-pdf` | 30-60s | Gemini, Supabase, jsPDF |
| **Email** | `/api/send-report-email`, `/api/generate-email-sequence`, `/api/notify-sale` | 30s | Resend, Nodemailer, Gemini |
| **Cron** | `/api/cron/send-nurture-emails`, `/api/backfill-email-drafts`, `/api/manual-send-emails` | 60s | Resend, Supabase |
| **Tracking** | `/api/track/open`, `/api/track/visit` | 10s | Supabase |
| **Admin** | `/api/admin/*` (12 endpoints) | 10-60s | Various |
| **Auth** | `/auth/callback` | 10s | Supabase Auth |

### 2.3 Library Layer (`lib/`)

```
lib/
├── vedic-calculator.js     ← Core domain logic (astronomical calculations)
│   ├── calculateBirthChart()   — planetary positions, houses, Navamsa
│   ├── computeManglik()        — deterministic Manglik Dosha
│   ├── computeYogas()          — Kaal Sarp, Budhaditya, Gajakesari, etc.
│   ├── computeDashaTimeline()  — real dates for Maha/Antar dasha
│   └── generateKundliSVG()     — North Indian chart visualization
│
├── report-generation.js    ← AI prompt construction + quality gate
├── fulfill-payment.js      ← Idempotent server-side payment fulfillment
├── email-sequence.js       ← 10-email nurture draft generator
├── gemini-retry.js         ← Exponential backoff for Gemini 503s
├── geocode.js              ← Nominatim + Indian city fallbacks
├── rate-limit.js           ← Supabase-backed persistent rate limiting
├── auth.js                 ← Timing-safe auth verification utilities
├── sanitize.js             ← Prompt injection + XSS prevention
├── schema.js               ← Schema.org JSON-LD builders
├── blog-posts.js           ← Static blog content library
├── blog-db.js              ← Dynamic blog from Supabase
├── supabase-browser.js     ← Client-side Supabase (auth)
└── supabase-server.js      ← Server-side Supabase (cookies/SSR)
```

---

## 3. Data Architecture

### 3.1 Database (Supabase PostgreSQL)

```
┌─────────────────────────────────────────────────────┐
│                    SUPABASE                           │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌─────────────┐    ┌──────────────┐                │
│  │  auth.users  │◄───│   reports     │                │
│  │  (Google     │    │  (main table) │                │
│  │   OAuth)     │    │              │                │
│  └─────────────┘    │  - lead data  │                │
│                      │  - chart_data │                │
│                      │  - sections   │                │
│                      │  - payment    │                │
│                      │  - emails     │                │
│                      │  - attribution│                │
│                      └──────────────┘                │
│                                                       │
│  ┌──────────────┐    ┌──────────────┐                │
│  │  blog_posts   │    │  rate_limits  │                │
│  │  (AI articles)│    │  (counters)   │                │
│  └──────────────┘    └──────────────┘                │
└─────────────────────────────────────────────────────┘
```

**Key design choice:** Single `reports` table serves as both leads and customers table. Payment status differentiates them. This simplifies queries but means unpaid leads share the same table as full reports.

### 3.2 Data Flow: Preview Generation

```
User submits form
    │
    ▼
[Rate Limit Check] ──→ 429 if exceeded
    │
    ▼
[Zod Validation] ──→ 400 if invalid
    │
    ▼
[Geocode Place] ──→ Nominatim API ──→ { lat, lng, timezoneOffset }
    │
    ▼
[Calculate Birth Chart]
    ├── astronomy-engine → tropical longitudes
    ├── Lahiri ayanamsa → sidereal conversion
    ├── Whole Sign houses → planet house placements
    ├── Navamsa (D9) computation
    ├── Manglik Dosha (deterministic)
    ├── Classical Yogas (deterministic)
    ├── Vimshottari Dasha timeline
    └── Kundli SVG generation
    │
    ▼
[Gemini AI: 2 Preview Sections]
    ├── Prompt includes: exact positions, signs, houses, dignities
    ├── Past validation (psychological hook)
    └── Personal insight (cut mid-sentence)
    │
    ▼
[Return to Client]
    ├── chartData (for later full report)
    ├── previewSections (2 sections)
    ├── kundliSVG
    ├── reportId (generated)
    └── city (extracted from geocode)
```

### 3.3 Data Flow: Payment & Fulfillment

```
                    ┌──────────────────────┐
                    │    THREE PATHS TO     │
                    │    FULFILLMENT        │
                    └──────────┬───────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
    [Browser Flow]      [Webhook Flow]      [Reconciliation]
    (verify-payment     (Razorpay server    (admin/reconcile
     → generate-full    to-server POST)      → scans recent
     → send-email)                           Razorpay payments)
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   fulfillPayment()    │
                    │   (IDEMPOTENT)        │
                    ├──────────────────────┤
                    │ 1. Load report row    │
                    │ 2. If done → skip     │
                    │ 3. Mark PAID          │
                    │ 4. Generate report    │
                    │ 5. Save to DB         │
                    │ 6. Email customer     │
                    │ 7. Notify owner       │
                    └──────────────────────┘
```

### 3.4 Data Flow: Email Nurture

```
[Preview Generated]
    │
    ▼ (server-side, non-blocking)
[generate-email-sequence]
    │── ONE Gemini call → 10 personalized emails
    │── Stored as JSONB in reports.email_drafts
    │
    ... time passes ...
    │
    ▼ (Vercel cron, 2x daily)
[send-nurture-emails]
    │── Query: unpaid + has email + has drafts + not completed/unsubscribed
    │── For each lead:
    │   ├── Is next email due? (hours since creation vs schedule)
    │   ├── Cooldown check (6h since last send)
    │   ├── Pick draft[emails_sent_count]
    │   ├── Send via Resend (→ Gmail fallback)
    │   ├── Increment emails_sent_count
    │   └── Time budget check (9s limit)
    │── Owner summary email
    └── Done (deferred leads caught next run)
```

---

## 4. Infrastructure

### 4.1 Hosting: Vercel

| Feature | Configuration |
|---------|--------------|
| Framework | Next.js 16 (App Router) |
| Region | Auto (edge for static, function for API) |
| Functions | Node.js serverless |
| Max duration | 60s (Pro plan) or 10s (Hobby) |
| Cron | 2 jobs: 9AM + 9PM IST |
| Analytics | Vercel Analytics + Speed Insights |
| Domain | www.bhavishai.in (custom) |

### 4.2 Database: Supabase

| Feature | Configuration |
|---------|--------------|
| Engine | PostgreSQL 15 |
| Auth | Google OAuth (provider) |
| RLS | Should be enabled (verify) |
| Backups | Automatic (paid plan) |
| Connection | Direct (not pooled) from serverless |
| Tables | `reports`, `blog_posts`, `rate_limits` |

### 4.3 External APIs

| Service | Usage | Rate Limits | Cost |
|---------|-------|-------------|------|
| Gemini 3.1-flash-lite | Report generation, email drafts | 15 RPM, 500 RPD | Free tier |
| Razorpay | Payment processing | No hard limit | 2% per txn |
| Resend | Email delivery | 2 req/sec, 100/day free | Free → $20/mo |
| Nominatim | Geocoding | 1 req/sec (courtesy) | Free |
| Gmail (SMTP) | Email fallback | 500/day | Free |

### 4.4 Cron Jobs

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/send-nurture-emails", "schedule": "30 3 * * *" },
    { "path": "/api/cron/send-nurture-emails", "schedule": "30 15 * * *" }
  ]
}
```

Both hit the same endpoint at 9:00 AM and 9:00 PM IST. Protected by `CRON_SECRET` header.

---

## 5. Security Architecture

### 5.1 Authentication Layers

```
┌─────────────────────────────────────────────────────┐
│                  AUTH HIERARCHY                       │
├─────────────────────────────────────────────────────┤
│                                                       │
│  PUBLIC (no auth):                                    │
│    generate-preview, save-report, create-order,      │
│    verify-payment, track/open                        │
│    → Protected by: rate limiting + input validation  │
│                                                       │
│  INTERNAL (server-to-server):                        │
│    send-report-email, notify-sale, generate-email-seq│
│    → Protected by: verifyInternal() + timing-safe    │
│                                                       │
│  CRON (Vercel scheduler):                            │
│    send-nurture-emails, backfill-email-drafts        │
│    → Protected by: verifyCron() + CRON_SECRET        │
│                                                       │
│  ADMIN (human operator):                             │
│    admin/data, admin/send-email, admin/reconcile...  │
│    → Protected by: verifyAdmin() + ADMIN_SECRET      │
│                                                       │
│  USER (Google OAuth):                                │
│    dashboard, link-reports                            │
│    → Protected by: Supabase Auth session             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

### 5.2 Payment Security

1. **Client-side:** Razorpay HMAC signature verification (`crypto.createHmac`)
2. **Server-side webhook:** Raw body signature verification (independent of browser)
3. **Reconciliation:** Admin endpoint cross-checks Razorpay's records against DB
4. **Price enforcement:** Server computes price; frontend cannot manipulate amount
5. **Idempotency:** `fulfillPayment()` is safe to call multiple times

### 5.3 AI Security

1. **Prompt injection prevention:** `sanitize.js` strips 16 known injection patterns
2. **Deterministic ground truth:** Astrology rules computed in code, injected as hard facts
3. **Output validation:** Quality gate rejects reports with <15 sections
4. **No user input in system prompt:** User question is clearly delimited and sandboxed

---

## 6. Scalability Considerations

### Current Scale (Low Traffic)
- ~10-50 reports/day
- Vercel free/hobby tier sufficient
- Gemini free tier (500 RPD) adequate
- Single Supabase project handles all

### Growth Bottlenecks (When They'll Hit)

| Bottleneck | Threshold | Solution |
|-----------|-----------|----------|
| Gemini 500 RPD | ~500 users/day | Upgrade to paid Gemini tier or queue system |
| Vercel 10s timeout (Hobby) | Nurture cron > 13 leads | Upgrade to Pro (60s) or split into smaller batches |
| Resend 100 emails/day (free) | ~50 leads (nurture + reports) | Upgrade to Resend paid ($20/mo) |
| Supabase connection limit | ~200 concurrent | Use connection pooling (pgBouncer) |
| Nominatim 1 req/sec | Burst of form submissions | Add caching layer or use paid geocoding |

### What Does NOT Need Scaling
- Static pages (already edge-cached by Vercel)
- Blog content (server-rendered, cacheable)
- PDF generation (one-shot per customer, not repeated)
- Admin panel (single user, low frequency)

---

## 7. Deployment Pipeline

```
Developer pushes to main
    │
    ▼
Vercel auto-deploys (CI/CD built-in)
    ├── Builds Next.js app
    ├── Deploys serverless functions
    ├── Invalidates edge cache for changed routes
    └── Live in ~60 seconds
```

- **No staging environment** — production-only (acceptable for solo dev, low-risk changes)
- **No automated tests** — relies on manual testing + lint
- **Rollback:** Vercel instant rollback to any previous deployment

---

## 8. Monitoring & Observability

| What | Tool | How |
|------|------|-----|
| Function errors | Vercel Logs | Real-time in dashboard |
| Page performance | Vercel Speed Insights | Web Vitals (LCP, FID, CLS) |
| Traffic | Vercel Analytics | Pageviews, unique visitors |
| Conversion funnel | Meta Pixel + GA4 | Lead → Checkout → Purchase |
| Email engagement | Custom (track/open pixel) | Open rates in admin panel |
| Payment health | Admin panel (overview tab) | Revenue, conversion rate |
| Gemini failures | Console logs | `[webhook]`, `[fulfill]` prefixes |
| Rate limit hits | Console logs | `[rate-limit]` prefix |

### What's Missing (Future)
- Error alerting (Sentry or similar)
- Uptime monitoring (external ping)
- Database query performance monitoring
- Cost tracking dashboard (Gemini tokens, Resend emails)

---

*Architecture decisions are documented inline in code comments. This document provides the 30,000-foot view.*
