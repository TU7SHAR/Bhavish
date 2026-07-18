# Code Audit

## BhavishAI — Implementation vs. Plan Comparison

**Last Audited:** July 2026
**Auditor:** AI (post-Phase 2 completion)
**Method:** Compare actual code files against `implementation_plan.md` checkboxes

---

## Audit Summary

| Phase | Planned Items | Implemented | Missing | Orphaned |
|-------|--------------|-------------|---------|----------|
| Phase 1 (MVP) | 45 | 45 | 0 | 0 |
| Phase 2 (Security) | 32 | 28 | 4 | 0 |
| Phase 3 (Growth) | 25 | 0 | — | — |
| Phase 4 (Expansion) | 20 | 0 | — | — |

**Overall Phase 2 completion: 87.5%**

---

## Phase 2: Detailed Audit

### 2.1 Payment Safety Net — COMPLETE
| Item | File | Status |
|------|------|--------|
| Razorpay webhook handler | `app/api/razorpay-webhook/route.js` | Present, verified |
| Webhook HMAC verification | `app/api/razorpay-webhook/route.js:39-43` | Uses `safeCompare()` |
| `fulfillPayment()` idempotent | `lib/fulfill-payment.js` | Checks `alreadyPaid && alreadyDelivered` |
| Admin reconciliation | `app/api/admin/reconcile-payments/route.js` | 3 modes: single, payment, scan |
| Triple-path delivery | webhook + browser + reconcile | All three exist |
| Payment gate on full report | `app/api/generate-full-report/route.js:38-44` | Checks `payment_status !== "paid"` → 403 |

### 2.2 Rate Limiting — COMPLETE
| Item | File | Status |
|------|------|--------|
| In-memory burst guard | `lib/rate-limit.js:52-70` | `localStore` Map |
| Supabase-backed persistence | `lib/rate-limit.js:108-145` | Calls `check_rate_limit` RPC |
| Per-route tiers | `lib/rate-limit.js:220-253` | 5 pre-configured limiters |
| Graceful degradation | `lib/rate-limit.js:135-138` | Fails open on DB error |
| SQL migration | `supabase/migrations/001_rate_limits_table.sql` | Present |

### 2.3 Input Security — COMPLETE
| Item | File | Status |
|------|------|--------|
| Zod validation | `app/api/generate-preview/route.js:17-24` | Schema with regex patterns |
| Prompt injection sanitization | `lib/sanitize.js:32-48` | 16 patterns |
| HTML entity encoding | `lib/sanitize.js:66-73` | `sanitizeForHtml()` |
| Name/place sanitization | `lib/sanitize.js:82-99` | Unicode-aware regex |
| Question length cap | Called as `sanitizeForPrompt(input, 300)` | 300 char max |

### 2.4 Auth Hardening — COMPLETE
| Item | File | Status |
|------|------|--------|
| Timing-safe comparison | `lib/auth.js:20-28` | `crypto.timingSafeEqual` |
| Fail-closed | `lib/auth.js:44-50` | Returns 500 if no secret |
| Internal API auth | `lib/auth.js:102-120` | `verifyInternal()` |
| Email endpoint auth | `app/api/send-report-email/route.js:165-182` | Paid status check for non-internal |
| Email match enforcement | `app/api/send-report-email/route.js:180` | Compares DB email to request email |

### 2.5 Timezone Fix — COMPLETE
| Item | File | Status |
|------|------|--------|
| Remove IST hardcoding | `lib/vedic-calculator.js:425-450` | `timezoneOffsetMinutes` param |
| LMT fallback | `lib/vedic-calculator.js:442` | `longitude / 15 * 60` |
| India bounding box | `lib/geocode.js:58-63` | `isIndianCoordinates()` |
| Day boundary wraparound | `lib/vedic-calculator.js:447-454` | `dayAdjust` logic |
| All callers updated | 3 API routes | Verified |

### 2.6 PDF Reliability — 75% COMPLETE
| Item | File | Status |
|------|------|--------|
| Server-side endpoint | `app/api/generate-pdf/route.js` | Present |
| Server-first download | `app/report/full/page.js:274-340` | Calls server, falls back to client |
| PDF in email | `app/api/send-report-email/route.js:209-220` | Attached if generation succeeds |
| **Store PDF URL in DB** | — | **NOT IMPLEMENTED** |

### 2.7 Email Engine Hardening — 75% COMPLETE
| Item | File | Status |
|------|------|--------|
| Pre-generated drafts | `lib/email-sequence.js` | One Gemini call → 10 drafts |
| 6-hour cooldown | `app/api/cron/send-nurture-emails/route.js:43` | `COOLDOWN_HOURS = 6` |
| 9-second time budget | `app/api/cron/send-nurture-emails/route.js:39` | `TIME_BUDGET_MS = 9000` |
| Resend rate compliance | `app/api/cron/send-nurture-emails/route.js:42` | `SEND_DELAY_MS = 600` |
| Unsubscribe endpoint | `app/api/unsubscribe/route.js` | Updates all rows for email |
| Email open tracking | `app/api/track/open/route.js` | 1x1 pixel GIF |
| **Bounce handling** | — | **NOT IMPLEMENTED** |
| **Complaint handling** | — | **NOT IMPLEMENTED** |

---

## Missing Items (Phase 2 Gaps)

| # | Item | Impact | Effort | Priority |
|---|------|--------|--------|----------|
| 1 | Store PDF URL in DB | Low — PDF can be regenerated | Medium (needs storage decision) | P2 |
| 2 | Bounce handling | Medium — sending to invalid emails wastes Resend quota | Medium (Resend webhook setup) | P1 |
| 3 | Complaint handling | Medium — spam reports can get domain blacklisted | Medium (Resend webhook setup) | P1 |
| 4 | Supabase RLS verification | High — if disabled, any anon key can read all data | Low (check + enable) | P0 |

---

## Orphaned Files (Code without plan item)

| File | Purpose | Orphaned? |
|------|---------|-----------|
| `app/api/admin/gift/route.js` | Gift a report to someone | No — admin utility |
| `app/api/admin/mark-gifted/route.js` | Mark report as gifted | No — admin utility |
| `app/api/admin/journey/route.js` | Customer journey view | No — admin utility |
| `app/api/admin/draft-reply/route.js` | AI draft reply to customer | No — admin utility |
| `app/api/admin/reply-email/route.js` | Send reply email | No — admin utility |
| `app/api/admin/send-thankyou/route.js` | Thank you email | No — admin utility |
| `app/api/admin/send-howto-email/route.js` | How-to email | No — admin utility |
| `app/api/admin/send-guidance-email/route.js` | Guidance confirmation | No — triggered by send-report-email |
| `app/api/admin/generate-guidance/route.js` | Generate guidance content | No — admin utility |
| `app/api/admin/expenses/route.js` | Expense tracking | No — admin utility |
| `app/api/guidance-reports/route.js` | Guidance report endpoint | No — part of guidance feature |
| `app/api/link-reports/route.js` | Link guest reports to user | No — auth flow |
| `app/api/track/visit/route.js` | Visit tracking | No — analytics |

**Conclusion:** No orphaned files found. All code maps to a feature or admin utility.

---

## Security Audit Checklist

| Check | Status | Notes |
|-------|--------|-------|
| All admin routes use `verifyAdmin()` | PASS | Verified in admin/* routes |
| Cron routes use `verifyCron()` | PASS | send-nurture-emails, backfill |
| Payment amount from server only | PASS | `create-order` computes price |
| Webhook uses raw body for HMAC | PASS | `request.text()` before parse |
| No secrets in client bundles | PASS | All in env vars, server-only |
| Rate limiting on all public AI routes | PASS | preview, full-report, email-gen |
| SQL injection risk | LOW | Supabase client parameterizes queries |
| XSS in generated reports | LOW | Content from AI, not directly from user |
| CSRF protection | MISSING | No token verification on POST routes |
| Supabase RLS enabled | UNVERIFIED | Need to check dashboard |

---

## Recommendations

### Immediate (This Week)
1. **Verify Supabase RLS is enabled** on `reports` table — if not, anyone with anon key can read all customer data
2. **Run rate limit migration** — rate limiting is local-only until then
3. **Merge PR #148** — timezone fix + PDF + rate limiter

### Short-term (This Month)
4. Set up Resend webhooks for bounce/complaint handling
5. Add CSRF token to payment routes (or verify Razorpay origin)
6. Consider adding `report_pdf_url` column to `reports` table

### Medium-term (Next Quarter)
7. Enable Sentry or similar for error alerting
8. Set up uptime monitoring
9. Add automated tests for critical paths (payment flow, chart calculation)

---

*Re-run this audit after completing Phase 2 remaining items and before starting Phase 3.*
