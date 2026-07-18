# Code Audit

## BhavishAI — Post-Hardening Audit (July 2026)

**Last Audited:** July 2026 (after PR #153 hardening pass)

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
