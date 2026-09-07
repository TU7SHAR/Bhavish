# BhavishAI

> AI-powered Vedic astrology SaaS. Enter your birth details → get a free preview → unlock a personalized 20+ page Janam Kundli report from ₹299.

**Live:** [www.bhavishai.in](https://www.bhavishai.in)

BhavishAI combines **precise astronomical calculations** with **AI interpretation** to generate detailed, personalized Vedic astrology (Janam Kundli) reports in about 60 seconds. The chart is computed deterministically (planetary positions, houses, dashas, doshas, yogas); the AI then interprets those computed facts — it never guesses the chart.

---

## ✨ Features

- **Free preview funnel** — birth-details form → geocoded chart → 2-section AI preview → paywall.
- **Three-tier reports** — Essential (₹299), Premium (₹499), Master (₹999, adds a concern-specific deep-dive + 24-month roadmap).
- **Deterministic engine** — planetary positions (Lahiri ayanamsa), Lagna, Nakshatra, Vimshottari Dasha, Manglik/Kaal Sarp/Yoga detection, North-Indian Kundli SVG.
- **Reliable payments** — Razorpay with HMAC verification, an idempotent fulfillment orchestrator, a webhook, and a self-healing reconciliation cron (no paid order is lost).
- **Email nurture engine** — 10 pre-generated, psychology-based nurture emails drip-sent via cron.
- **Free SEO tools** — e.g. the [Manglik Dosha Calculator](https://www.bhavishai.in/tools/manglik-calculator), built on the same engine as the paid report.
- **Content & SEO** — blog with topic clusters, schema.org structured data, sitemap, `llms.txt`.
- **Admin dashboard** — revenue/leads/payments/emails, analytics, diagnostics, data export, and guidance-report generation.
- **Attribution + tracking** — UTM/fbclid/gclid capture, Meta Pixel + Conversions API, GA4.

---

## 🧱 Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Styling | Tailwind CSS 4 |
| Database / Auth | Supabase (PostgreSQL, Google OAuth) |
| Payments | Razorpay |
| AI | Google Gemini (`gemini-3.1-flash-lite`) |
| Astronomy | `astronomy-engine` (Swiss-Ephemeris-equivalent) + Lahiri ayanamsa |
| Email | Resend (primary) + Gmail/Nodemailer (fallback) |
| PDF | jsPDF |
| Hosting | Vercel |
| Analytics | Meta Pixel + Conversions API, GA4, Vercel Analytics |

---

## 🚀 Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local   # then fill in the values (see below)

# 3. Run the dev server
npm run dev                  # http://localhost:3000

# Production build / lint
npm run build
npm run lint
```

> **Node:** use Node 20+ (Node 22 recommended).

### Environment variables

Copy `.env.example` and fill in the required keys. Highlights:

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Google AI Studio key (report generation) |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (cron/admin) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payments |
| `RAZORPAY_WEBHOOK_SECRET` | Payment webhook verification |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Email delivery |
| `NEXT_PUBLIC_META_PIXEL_ID` / `META_CAPI_ACCESS_TOKEN` | Meta tracking (browser + server) |
| `CRON_SECRET` / `ADMIN_SECRET` | Protect cron + admin endpoints |
| `NEXT_PUBLIC_APP_URL` | Base URL |

See `.env.example` for the complete list.

### Database setup

Apply the SQL migrations in **Supabase → SQL Editor** (they are idempotent). See
`supabase/migrations/`. Notable ones: rate limiting, plan/tier fields, the atomic
report-generation claim, report access tokens, Meta-purchase + owner-notify flags.

---

## 📁 Project structure

```
app/
├── page.js                 # Landing page
├── get-report/             # Birth-details form
├── report/preview | full   # Paywall + full report
├── tools/                  # Free SEO tools (e.g. Manglik calculator)
├── kundli/ | marriage/     # SEO topic-cluster landing pages
├── blog/                   # Blog index + [slug] articles
├── admin/                  # Super-admin dashboard
└── api/                    # Serverless routes (preview, payment, cron, admin…)
lib/                        # Domain logic (vedic-calculator, fulfill-payment, meta-capi, …)
public/                    # Static assets
supabase/migrations/       # SQL migrations
docs/                      # Detailed project documentation
commands/                  # Per-file/route reference
```

---

## 📚 Documentation

This repo keeps living documentation in lockstep with the code:

| Doc | What it covers |
|-----|----------------|
| [PROJECT.md](PROJECT.md) | Full project reference (architecture, funnel, routes, DB schema, security) |
| [docs/architecture.md](docs/architecture.md) | System architecture & data flows |
| [docs/prd.md](docs/prd.md) | Product requirements |
| [docs/requirements.md](docs/requirements.md) | Non-functional specs & constraints |
| [docs/implementation_plan.md](docs/implementation_plan.md) | Phase-based roadmap |
| [docs/bugs.md](docs/bugs.md) | Structured bug log |
| [docs/testing.md](docs/testing.md) | Manual test checklist |
| [docs/DOCS_MAINTENANCE.md](docs/DOCS_MAINTENANCE.md) | The living-docs contract |
| [commands/](commands/) | Reference for every API route, lib module, page & command |

---

## 🔒 A note on positioning

Reports are generated using high-precision astronomical calculations combined
with classical Vedic (Jyotish) principles, interpreted by AI. They are intended
for guidance and reflection — not a substitute for professional medical, legal
or financial advice.

---

*For deeper detail on any part of the system, start with [PROJECT.md](PROJECT.md).*
