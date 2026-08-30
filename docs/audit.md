# Code Audit

## BhavishAI — Post-Hardening Audit (August 2026)

**Last Audited:** August 2026 (after admin Overview accuracy pass — PRs #180, #181)
**Prior audit:** July 2026 (after PR #153 hardening pass)

---

## Admin Dashboard Accuracy Audit (August 2026)

| Check | Status | Notes |
|-------|--------|-------|
| Overview counts ALL rows (not just first 1000) | **PASS** | Paginated `.range()` fetch, PR #180 |
| Overview always reflects live DB (no stale cache) | **PASS** | `force-dynamic` + client `no-store`, PR #181 |
| Overview fetch is lightweight (no heavy JSONB) | **PASS** | Selects only aggregation columns, PR #180 |
| Missed UPI payments self-heal | **PASS** | Hourly `/api/cron/reconcile-payments`, PR #176 |
| Diagnose tool to explain a missing row | **PASS** | `/api/admin/diagnose-report`, read-only, PR #179 |
| Data export (backup) available | **PASS** | `/api/admin/export` JSON + CSV, PR #177 |
| Analytics tab counts ALL rows | **FAIL** | Same 1000-row cap; tracked as BUG-022 (follow-up PR) |

---

## Security Audit — Payment & Fulfillment

| Check | Status | Notes |
|-------|--------|-------|
| save-report cannot set payment_status | **PASS** | Forces "unpaid"; strips paymentId/reportStatus/plan fields |
| verify-payment derives plan from Razorpay order (not client) | **PASS** | Fetches order, reads notes.planId/reportId |
| generate-full-report uses only DB data | **PASS** | Accepts only { reportId }, loads all from Supabase |
| No browser+webhook double-generation | **PASS** | Atomic lock via report_status="generating" + 409 conflict |
| Master email only after deep-dive completes | **PASS** | fulfillPayment holds email; deep-dive endpoint sends final |
| Founder purchase APIs disabled for new users | **PASS** | 410 Gone on create-upgrade-order + verify-upgrade |
| Razorpay HMAC signature verification | **PASS** | Both verify-payment and webhook verify before any action |
| Server-side pricing (never trust client amount) | **PASS** | create-order resolves from lib/plans.js |
| Rate limiting on all public AI routes | **PASS** | Supabase-backed + in-memory burst guard |
| Timing-safe auth comparison | **PASS** | crypto.timingSafeEqual in lib/auth.js |
| Prompt injection sanitization | **PASS** | lib/sanitize.js (16 patterns) |
| Zod schema validation on generate-preview | **PASS** | .parse() called, errors returned as 400 |
| Form sends sanitized data | **PASS** | cleanData (not raw formData) sent to API + stored |
| Founder monthly limit enforced | **PASS** | Defaults to 5 (contractual), env-overridable |

## Known Remaining Issues

| Issue | Severity | Status |
|-------|----------|--------|
| Private report link URLs sent to GA/Pixel | Low | Accepted risk (192-bit token, noindex, no PII) |
| No Kundli SVG chart in PDF | Low | Cosmetic; PDF has text table + all sections |
| CSRF protection not implemented | Low | Razorpay popup + HMAC mitigates payment CSRF; other routes are read-only or auth-gated |
| Supabase RLS unverified on production | Medium | Migration 003 written; must run after deploy |
| Admin revenue calc for filtered dates uses plan_price (PR #152 needed) | Low | Only affects admin; merged separately |
| Analytics tab 1000-row cap + no force-dynamic | Medium | BUG-022; same fix as Overview, follow-up PR |

## Architecture Correctness

| Flow | Single Source of Truth | Verified |
|------|----------------------|----------|
| Payment status | Razorpay signature → server-side DB write only | Yes |
| Plan tier/price | Razorpay order.notes (set by create-order) | Yes |
| Birth data for report generation | Supabase reports.chart_data | Yes |
| Report generation ownership | Atomic report_status lock | Yes |
| Master completion | deep-dive endpoint → merge → email | Yes |
| Founder access | is_founder_member in DB (legacy, grandfathered) | Yes |

---

*Next audit: after enabling RLS (migration 003) in production.*
