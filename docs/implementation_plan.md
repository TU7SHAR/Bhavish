# Implementation Plan

## BhavishAI — Phase-Based Roadmap

**Version:** 1.1
**Last Updated:** September 2026
**Status:** Phase 1 complete, Phase 2 in progress (reliability/security largely done)

---

## Phase 1: MVP Core (COMPLETE)

> Goal: Working funnel from ad click → paid report delivery

### 1.1 Landing & Form
- [x] Landing page with hero, features, pricing, FAQ
- [x] Social proof section (static numbers)
- [x] Birth details form (name, DOB, time, place, gender, email)
- [x] Personal question field (optional)
- [x] Custom time picker (hour/minute/AM-PM dropdowns)
- [x] Client-side input sanitization (strip HTML)
- [x] Date validation (not future, not pre-1920)
- [x] Loading UX with rotating astrology messages
- [x] Double-click protection

### 1.2 Chart Calculation Engine
- [x] Geocoding (Nominatim + Indian city fallbacks)
- [x] Planetary position calculation (astronomy-engine, geocentric)
- [x] Lahiri Ayanamsa computation
- [x] Sidereal longitude conversion
- [x] Whole Sign house system
- [x] Nakshatra + Pada determination
- [x] Vimshottari Dasha sequence (planet order + years)
- [x] Planet dignity classification (exalted/debilitated/own/mooltrikona)
- [x] North Indian Kundli SVG generation
- [x] Navamsa (D9) computation for all planets + ascendant

### 1.3 AI Report Generation
- [x] Gemini integration with retry wrapper (exponential backoff)
- [x] Preview generation (2 sections + summary + past validation + personal insight)
- [x] Full 20-section report generation
- [x] Prompt injection sanitization
- [x] Quality gate (≥15 sections required)
- [x] Lucky factors computed from ascendant (not AI-generated)
- [x] Current dasha/antardasha timeline injected as ground truth

### 1.4 Deterministic Astrology Rules
- [x] Manglik Dosha (Mars in 1/2/4/7/8/12 from Lagna, Moon, Venus)
- [x] Kaal Sarp Yoga detection (all planets on one side of Rahu-Ketu axis)
- [x] Budhaditya Yoga (Sun-Mercury conjunction)
- [x] Gajakesari Yoga (Jupiter in kendra from Moon)
- [x] Chandra-Mangala Yoga (Moon-Mars conjunction)
- [x] Pancha Mahapurusha Yogas (5 types)
- [x] Neecha Bhanga Raja Yoga (debilitation cancellation)
- [x] Dasha timeline with exact dates + current running period

### 1.5 Payment Integration
- [x] Razorpay order creation (server-side pricing)
- [x] Client-side HMAC signature verification
- [x] Database payment status update
- [x] Order bump (₹149 guidance add-on)
- [x] Founder upgrade (₹999 lifetime)

### 1.6 Report Delivery
- [x] Full report page (20 sections rendered)
- [x] PDF generation (server-side with jsPDF)
- [x] Email delivery (Resend primary, Gmail fallback)
- [x] PDF attachment in email
- [x] Report save to Supabase

### 1.7 User Accounts
- [x] Google OAuth via Supabase Auth
- [x] Dashboard with saved reports
- [x] Guest report linking (by email on login)
- [x] Auth callback handler

---

## Phase 2: Reliability & Security (IN PROGRESS)

> Goal: No payment ever lost, no abuse possible, production-grade reliability

### 2.1 Payment Safety Net
- [x] Razorpay webhook handler (server-to-server)
- [x] Webhook HMAC signature verification (raw body)
- [x] `fulfillPayment()` idempotent function
- [x] Admin reconciliation endpoint (scan recent Razorpay payments)
- [x] Triple-path delivery (browser + webhook + reconcile)
- [x] Payment gate on generate-full-report (verify paid in DB)
- [x] Auto-reconciliation cron (`/api/cron/reconcile-payments`, hourly) — self-heals missed UPI payments without manual action (PR #176)
- [x] cron-job.org setup guide for sub-hourly / header-authed triggering (docs/cron-setup.md, PR #178)
- [ ] Configure `RAZORPAY_WEBHOOK_SECRET` in Razorpay + Vercel (webhook safety net currently placeholder)

### 2.2 Rate Limiting
- [x] In-memory burst guard (per-instance)
- [x] Supabase-backed persistent rate limiting (cross-instance)
- [x] Per-route rate limit tiers (preview=3, payment=5, save=10, tracking=30)
- [x] Graceful degradation (fail-open if DB unreachable)
- [x] Rate limit SQL migration script

### 2.3 Input Security
- [x] Zod schema validation on generate-preview
- [x] Prompt injection sanitization (16 patterns)
- [x] HTML entity encoding for email output
- [x] Name/place sanitization (unicode-aware)
- [x] Personal question length cap (300 chars)

### 2.4 Auth Hardening
- [x] Timing-safe secret comparison (crypto.timingSafeEqual)
- [x] Fail-closed (no secret configured → deny all)
- [x] Internal API authentication (server-to-server)
- [x] Email endpoint authorization (verifyInternal or paid-report check)
- [x] Email address match enforcement (can't send to arbitrary addresses)

### 2.5 Timezone Fix
- [x] Remove IST hardcoding from vedic-calculator
- [x] Accept `timezoneOffsetMinutes` parameter
- [x] Local Mean Time fallback from longitude
- [x] India bounding box detection (auto IST for Indian coordinates)
- [x] Day boundary wraparound handling
- [x] All callers updated (generate-preview, founder/generate, admin/regenerate)

### 2.6 PDF Reliability
- [x] Server-side PDF generation endpoint (`/api/generate-pdf`)
- [x] Download button uses server-first, client-fallback strategy
- [x] PDF attached to report email
- [ ] Store generated PDF URL in DB (for re-download without regeneration)

### 2.7 Email Engine Hardening
- [x] Pre-generated email drafts (no AI at send time)
- [x] 6-hour cooldown between sends
- [x] 9-second time budget (defers rest to next cron run)
- [x] Resend rate limit compliance (600ms delay)
- [x] Unsubscribe endpoint (marks all rows for email)
- [x] Email open tracking (1x1 pixel)
- [ ] Bounce handling (mark invalid emails)
- [ ] Complaint handling (auto-unsubscribe on spam report)

### 2.8 Admin Dashboard Reliability (August 2026)
- [x] Overview counts ALL rows via pagination (fixes 1000-row Supabase cap — PR #180)
- [x] Overview fetch is lightweight (only aggregation columns, not heavy JSONB — PR #180)
- [x] Overview always live (`force-dynamic` + client `no-store` — PR #181)
- [x] "Diagnose Missing Payment" tool (`/api/admin/diagnose-report`, read-only — PR #179)
- [x] Data export — full JSON backup + per-table CSV (`/api/admin/export` — PR #177)
- [x] Bulk monthly-guidance generation (free-tier-safe, sequential — PR #177)
- [ ] Apply the same pagination + `force-dynamic` fix to `/api/admin/analytics` (BUG-022)

---

## Phase 3: Growth & Optimization (PLANNED)

> Goal: Scale to 500+ reports/day, optimize conversion, reduce costs

### 3.1 Conversion Optimization
- [ ] A/B test paywall CTA copy
- [ ] A/B test preview section count (1 vs 2 vs 3)
- [ ] Exit-intent popup on preview page
- [ ] Countdown timer on discount email (#10)
- [ ] Dynamic social proof (real count from DB)
- [ ] Testimonial section with real reviews
- [ ] WhatsApp share button on full report

### 3.2 SEO & Organic Growth
- [ ] Auto-generate 2 blog articles/week (AI + schedule)
- [ ] Internal linking between blog posts
- [ ] FAQ schema on blog articles
- [ ] City-specific landing pages (e.g., "Kundli in Mumbai")
- [ ] Hindi language blog articles
- [ ] Video content embeds (YouTube shorts)
- **High-intent topic-cluster landing pages** (SEO "money pages" with FAQ + Breadcrumb schema, internal-linked into tools + `/get-report`), via the reusable `components/ClusterLanding.js`:
  - [x] `/kundli/janam-kundli` (Kundli pillar)
  - [x] `/kundli/kundli-by-date-of-birth`
  - [x] `/marriage/manglik-dosha` (paired with the Manglik tool)
  - [ ] `/kundli/free-kundli`, `/marriage/kundli-matching`, Dasha / Dosha / Career clusters
  - See `docs/seo-audit.md` §7 for the full cluster map.

### 3.3 Performance
- [ ] Edge caching for blog pages (ISR with revalidation)
- [ ] Image optimization (OG images, blog headers)
- [ ] Bundle size analysis and reduction
- [ ] Lazy load non-critical components
- [ ] Preconnect to Gemini/Supabase/Razorpay domains

### 3.4 Infrastructure Upgrades
- [x] **Meta Conversions API — server-side Purchase tracking** (`lib/meta-capi.js`, fired from `fulfillPayment`). Fixes the browser-only Purchase event that missed UPI/closed-tab sales (why Purchase showed "inactive" in Meta). Deduped with the browser Pixel via shared `event_id`. Requires `META_CAPI_ACCESS_TOKEN` env + running migration `006_meta_purchase_flag.sql`.
- [ ] Upgrade to Gemini paid tier (when 500 RPD limit hit)
- [ ] Upgrade Resend to paid plan (when 100/day limit hit)
- [ ] Supabase Pro (connection pooling, backups)
- [ ] Error monitoring (Sentry integration)
- [ ] Uptime monitoring (external service)
- [ ] Database query performance monitoring

### 3.5 Email Improvements
- [ ] Dynamic discount codes (per-user, trackable)
- [ ] Re-engagement sequence for expired leads (>45 days)
- [ ] Welcome email for paid customers
- [ ] Review request email (7 days post-purchase)
- [ ] Guidance reminder emails (for 12-month pack buyers)

---

## Phase 4: Product Expansion (FUTURE)

> Goal: New revenue streams, deeper engagement

### 4.1 New Products
- [ ] Kundli Matching (compatibility report for couples) — ₹499
- [ ] Annual Transit Report (yearly predictions refresh) — ₹199/year
- [ ] Muhurat Calculator (auspicious timing for events) — ₹99
- [ ] Career Deep-Dive Report (focused 10-page career analysis) — ₹199

### 4.2 Platform Features
- [ ] Report history timeline (visual)
- [ ] Comparison view (birth chart vs transit chart)
- [ ] Shareable report cards (Instagram story format)
- [ ] Push notifications for dasha period changes
- [ ] Referral program (₹50 credit per referral)

### 4.3 Technical Advancement
- [ ] Multiple AI model support (Gemini + Claude fallback)
- [ ] Report generation queue (handle 1000+ concurrent)
- [ ] CDN-stored PDFs (don't regenerate)
- [ ] Redis for rate limiting + session cache
- [ ] Multi-region deployment
- [ ] Automated testing pipeline (CI/CD with tests)

### 4.4 Business
- [ ] Google Ads campaign (alongside Meta)
- [ ] Influencer partnerships (astrology Instagram accounts)
- [ ] Affiliate program for astrology blogs
- [ ] Corporate wellness packages (team readings)
- [ ] API access for third-party developers

---

## Execution Guidelines

### How to use this plan:

1. **Current focus:** Work on Phase 2 (checkboxes without [x])
2. **Per-session:** Pick 1-3 items from the current phase → add to `task.md`
3. **After completion:** Run audit (`audit.md`) to verify against this plan
4. **Phase transition:** Only move to next phase when current is 90%+ complete
5. **New ideas:** Add to appropriate future phase — don't interrupt current work

### Priority within a phase:
- **P0 (do first):** Items that affect payment/revenue/data-loss
- **P1 (do next):** Items that affect user experience or conversion
- **P2 (do later):** Items that are nice-to-have improvements

### Definition of Done:
- Feature works in production (not just locally)
- No console errors in Vercel logs
- Edge cases handled (empty inputs, network failures)
- Existing features still work (no regressions)
- Checkbox marked [x] in this file

---

*Review this plan monthly. Reprioritize based on actual traffic data and conversion metrics.*
