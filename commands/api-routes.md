# API Routes Reference

Every serverless endpoint under `app/api/**/route.js`. Auth legend is defined in
[`README.md`](README.md). Source of truth is the code — correct this file if it drifts.

---

## Public funnel

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `generate-preview` | POST | None | Zod-validates input, geocodes place (Nominatim), computes chart (`vedic-calculator`), calls Gemini for 2 preview sections. Rate-limited (`previewLimiter`, 3/min). Returns `chartData` + preview + Kundli SVG + `reportId`. |
| `save-report` | POST | None | Upserts a lead to Supabase with attribution. **Forces `payment_status='unpaid'`** and strips any payment/plan fields (paywall-safety). Rate-limited (`saveLimiter`). |
| `generate-email-sequence` | POST | None | ONE Gemini call → 10 nurture email drafts → stored as JSONB in `reports.email_drafts`. Rate-limited (`emailGenLimiter`, 2/min). |
| `create-order` | POST | None | Creates a Razorpay order. **Server-side pricing** from `lib/plans.js`; plan/report info written to `order.notes`. Rate-limited (`paymentLimiter`). |
| `verify-payment` | POST | None | Verifies Razorpay HMAC signature. Derives `reportId`/`planId`/amount from the **Razorpay order notes** (never the client). Marks report paid via `fulfillPayment()`. |
| `generate-full-report` | POST | Payment-gated | Accepts ONLY `{ reportId }`, loads all data from DB, returns 403 unless paid. Atomic `claim_report_generation` RPC prevents double-generation (202 if another process owns it). Idempotent. |
| `generate-master-deep-dive` | POST | None* | Master tier only: generates the 7-section deep-dive + 24-month roadmap as a *separate* job (avoids 60s timeout). Appends to the report and sends the final Master email. |
| `generate-pdf` | POST | None | Server-side PDF generation (primary path; client jsPDF is the fallback). |
| `link-reports` | POST | None | Links guest reports to a logged-in user by matching email. |
| `unsubscribe` | POST | None | Marks all rows for an email `email_sequence_status='unsubscribed'`; supports `{ resubscribe: true }`. No info leak on unknown email. |

\* Idempotent + internally guarded; safe to call more than once.

## Upgrades (retired, grandfathered)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `create-upgrade-order` | POST | None | **Returns 410 Gone** — founder upgrade retired for new users. |
| `verify-upgrade` | POST | None | **Returns 410 Gone** — founder upgrade retired for new users. |

## Email / notification (server-to-server)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `send-report-email` | POST | Internal | Emails the full report (Resend → Gmail fallback). Recipient-match enforced. |
| `notify-sale` | POST | Internal | Emails the owner about a new sale. |

## Payments (webhook + reconciliation)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `razorpay-webhook` | POST | HMAC | Server-to-server payment events. Verifies raw-body HMAC signature. Idempotent via `fulfillPayment()`. Returns `not_configured` if `RAZORPAY_WEBHOOK_SECRET` is unset (no retry storm). |
| `cron/reconcile-payments` | GET | Cron | Hourly safety net — scans recent captured Razorpay payments and fulfils any missed by the browser/webhook. Idempotent. |
| `cron/send-nurture-emails` | GET | Cron | Reads pre-generated drafts, sends the next due email. 9s time budget, 6h cooldown, 600ms Resend pacing. |
| `backfill-email-drafts` | GET | Cron | Generates drafts for old leads missing them. Batch of 3. |
| `manual-send-emails` | GET | Cron | Sends all due emails (no time budget; ~8.5s budget override via `?budget`). Supports `?force`, `?fresh`, `?email`. |

## Tracking

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `track/open` | GET | None | Returns a 1×1 pixel GIF; logs email opens to `reports.email_opens`. Rate-limited (`trackingLimiter`). |
| `track/visit` | POST | None | Fire-and-forget page-view event → `visitor_sessions` table (attribution/journey). |

## User dashboard

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `guidance-reports` | GET | User | Returns the logged-in user's monthly guidance reports for a `reportId`, ordered by month. |

## Founder (grandfathered members)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `founder/generate` | POST | User/Founder | Generates a report using a grandfathered founder's perk. Monthly limit enforced (default 5, env-overridable). |

## Admin (super admin panel)

All require `Admin` auth (`ADMIN_SECRET`, falls back to `CRON_SECRET`).

| Route | Method | Purpose |
|-------|--------|---------|
| `admin/data` | GET | Dashboard data by `?tab=` (overview/leads/payments/emails/blog/…). `force-dynamic`, paginated (counts ALL rows). |
| `admin/analytics` | GET | Analytics aggregates. ⚠️ **BUG-022:** still 1000-row-capped + not `force-dynamic`. |
| `admin/journey` | GET | Visitor-journey analytics: consideration time, returning vs impulse buyers, session breakdowns. |
| `admin/expenses` | GET/POST | Expenses CRUD powering the Economics tab. `?from&to` date filter on GET. |
| `admin/export` | GET | Data export: `?format=json` (full backup) or `?format=csv&table=reports\|guidance\|blog`. |
| `admin/diagnose-report` | GET | Read-only: explains why a `?reportId=`/`?email=` is/isn't counted in Overview. |
| `admin/reconcile-payments` | GET | Manual reconciliation: `?reportId=`, `?paymentId=`, or `?count=`. |
| `admin/blog-debug` | GET | Diagnostic: raw DB read results for blog troubleshooting. |
| `admin/generate-guidance` | POST | Generates ONE month of guidance via Gemini + emails the customer. `{ reportId, monthNumber, force? }`. |
| `admin/generate-article` | POST | Gemini writes an SEO article → `blog_posts` table. |
| `admin/regenerate-report` | POST | Tier-aware full regeneration from birth details (essential/premium/master). |
| `admin/draft-reply` | POST | AI-drafts a support reply (Gemini). |
| `admin/reply-email` | POST | Sends/replies to any address from support@. `{ to, subject, body, reportId?, inReplyTo? }`. |
| `admin/send-email` | POST | Send email to a single lead (scheduled/force/custom modes). |
| `admin/resend-report` | POST | Re-send the full-report email to a paid customer. `{ reportId }`. |
| `admin/send-guidance-email` | POST | Send the "12-Month Guidance Pack purchased" confirmation. `{ reportId }`. |
| `admin/send-howto-email` | POST | Send the "How to use BhavishAI" guide (manual only). `{ reportId }`. |
| `admin/send-thankyou` | POST | Send a personal founder thank-you to a paid user. `{ reportId }`. |
| `admin/gift` | POST | Gift/upgrade: `{ reportId, type: guidance\|founder\|upgrade_premium\|upgrade_master }`. |
| `admin/mark-gifted` | POST | Toggle `is_guidance_gifted`/`is_founder_gifted`. `{ reportId, field, value }`. |

## Auth

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/auth/callback` | GET | None | Handles Google OAuth redirect; links reports by email. (Under `app/auth`, not `app/api`.) |

*Last updated: September 2026*
