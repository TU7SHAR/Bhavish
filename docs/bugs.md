# Bug Log

## BhavishAI — Structured Issue Tracker

**Last Updated:** July 2026

---

## Format

Each bug entry follows this structure:
```
### BUG-XXX: [Short Title]
**Status:** Open | Fixed | Won't Fix
**Severity:** Critical | High | Medium | Low
**Discovered:** [Date]
**Fixed in:** [Commit/PR] (if fixed)

**Symptom:** What the user sees or what breaks
**Console Error:** Exact error message (if available)
**Affected Files:** Which files are involved
**Hypothesis:** What we think is causing it (BEFORE coding the fix)
**Root Cause:** What actually caused it (AFTER fixing)
**Fix:** What was done to resolve it
```

---

## Open Bugs

### BUG-007: CSRF vulnerability on payment routes
**Status:** Open
**Severity:** Medium
**Discovered:** July 2026

**Symptom:** No CSRF token verification on POST routes. A malicious site could theoretically submit forms to `/api/create-order` on behalf of a logged-in user.
**Console Error:** N/A (no error — it's a missing protection)
**Affected Files:** `app/api/create-order/route.js`, `app/api/verify-payment/route.js`
**Hypothesis:** Need to add origin/referer header check or CSRF token. Razorpay's signature verification partially mitigates this (attacker can't complete payment without user's action in Razorpay popup).
**Root Cause:** —
**Fix:** Pending — low risk because payment requires user interaction in Razorpay popup

---

### BUG-008: Supabase RLS status unverified
**Status:** Open
**Severity:** High
**Discovered:** July 2026

**Symptom:** If RLS is disabled on the `reports` table, anyone with the anon key (which is public in the frontend) could read ALL customer data via Supabase REST API.
**Console Error:** N/A
**Affected Files:** Supabase dashboard (not in code)
**Hypothesis:** RLS may not be enabled since it's not referenced in any migration files.
**Root Cause:** —
**Fix:** Check Supabase dashboard → Table → RLS policies. Enable if disabled. Add policy: `auth.uid() = user_id` for user reads, service_role for all operations.

---

### BUG-009: Duplicate leads not deduplicated
**Status:** Open
**Severity:** Low
**Discovered:** July 2026

**Symptom:** Same person submitting the form multiple times creates multiple rows in `reports` table (each with a unique `report_id`). This inflates lead count and sends multiple email sequences.
**Console Error:** N/A
**Affected Files:** `app/api/save-report/route.js`
**Hypothesis:** Deduplication by email could prevent this, but might break legitimate re-submissions (user wants a new chart with corrected birth time).
**Root Cause:** By design — each submission is a unique "report attempt"
**Fix:** Consider: if same email submitted within 5 minutes, update existing row instead of creating new. Or: deduplicate email sequence (only one active sequence per email).

---

## Fixed Bugs

### BUG-001: Mercury/Venus in impossible signs
**Status:** Fixed
**Severity:** Critical
**Discovered:** June 2026
**Fixed in:** vedic-calculator.js refactor

**Symptom:** Mercury showing in Scorpio while Sun is in Gemini (astronomically impossible — Mercury stays within ~28° of Sun).
**Console Error:** None (wrong data, not a crash)
**Affected Files:** `lib/vedic-calculator.js`
**Hypothesis:** Using heliocentric longitude instead of geocentric.
**Root Cause:** `Astronomy.EclipticLongitude()` returns HELIOCENTRIC position (as seen from Sun). Birth charts require GEOCENTRIC (as seen from Earth).
**Fix:** Changed to `Astronomy.GeoVector()` → `Astronomy.Ecliptic()` → `.elon` for Mars, Mercury, Jupiter, Venus, Saturn. Sun/Moon kept with their specific methods.

---

### BUG-002: LLM gives contradictory Manglik/Yoga verdicts
**Status:** Fixed
**Severity:** High
**Discovered:** June 2026
**Fixed in:** vedic-calculator.js — `computeManglik()`, `computeYogas()`

**Symptom:** Regenerating the same chart would sometimes say "Manglik: YES" and sometimes "Manglik: NO". Same for Kaal Sarp Yoga.
**Console Error:** None (inconsistent AI output)
**Affected Files:** `lib/vedic-calculator.js`, `lib/report-generation.js`
**Hypothesis:** The LLM is unreliable at computing house positions from sign indices. It wrongly called 9th-house Mars "Manglik" (only 1/2/4/7/8/12 are Manglik houses).
**Root Cause:** AI was asked to determine Manglik/Yoga status itself instead of being given the computed answer.
**Fix:** Compute all deterministic astrology rules in JavaScript. Inject verdicts into AI prompt as "HARD FACTS" with strict instructions to use them verbatim.

---

### BUG-003: IST hardcoding breaks non-Indian charts
**Status:** Fixed
**Severity:** High
**Discovered:** July 2026
**Fixed in:** PR #148

**Symptom:** Charts for users born in USA/UK/etc. show wrong ascendant and planetary positions (offset by ~5-10 hours of Earth rotation).
**Console Error:** None (wrong data, not a crash)
**Affected Files:** `lib/vedic-calculator.js`, `lib/geocode.js`
**Hypothesis:** `calculateBirthChart` hardcodes `hours - 5; minutes - 30` (IST).
**Root Cause:** Confirmed — UTC conversion assumed all users are in India.
**Fix:** Accept `timezoneOffsetMinutes` parameter. For Indian coordinates (bounding box check), use 330 (IST). For others, compute from longitude (LMT: longitude/15 * 60). Added day boundary wraparound handling.

---

### BUG-004: UPI payments showing as "unpaid"
**Status:** Fixed
**Severity:** Critical
**Discovered:** June 2026
**Fixed in:** razorpay-webhook + fulfill-payment.js

**Symptom:** Customer pays via UPI (in GPay/PhonePe app), payment shows in Razorpay dashboard as "captured", but BhavishAI shows "unpaid" and customer never gets report.
**Console Error:** None (browser callback never fires — user left the tab)
**Affected Files:** `app/api/razorpay-webhook/route.js`, `lib/fulfill-payment.js`
**Hypothesis:** The Razorpay `handler` callback in the browser only fires if the user returns to the tab. UPI payments complete in another app.
**Root Cause:** Confirmed — no server-side payment notification mechanism existed.
**Fix:** Added Razorpay webhook handler (`order.paid` / `payment.captured` events), idempotent `fulfillPayment()` function, and admin reconciliation endpoint as backstop.

---

### BUG-005: In-memory rate limiter ineffective
**Status:** Fixed
**Severity:** Medium
**Discovered:** July 2026
**Fixed in:** PR #148

**Symptom:** Rate limiter doesn't actually block repeat offenders consistently. Same IP can bypass by waiting for cold start or hitting parallel instances.
**Console Error:** None (it just doesn't block)
**Affected Files:** `lib/rate-limit.js`
**Hypothesis:** JavaScript `Map()` is per-instance on Vercel. Multiple instances = multiple independent maps. Cold start = fresh map.
**Root Cause:** Confirmed — serverless functions don't share memory.
**Fix:** Replaced with Supabase-backed persistent rate limiting. In-memory Map kept as burst guard + DB-unreachable fallback.

---

### BUG-006: PDF only available from browser
**Status:** Fixed
**Severity:** Medium
**Discovered:** July 2026
**Fixed in:** PR #148

**Symptom:** If user's browser crashes mid-download, or if jsPDF fails to load (ad blockers, old browsers), they can't get their PDF. Only option is to re-open the report page and try again.
**Console Error:** Varies (jsPDF import failures, memory issues)
**Affected Files:** `app/report/full/page.js`
**Hypothesis:** The Download PDF button runs everything client-side. No server fallback.
**Root Cause:** Confirmed — `import("jspdf")` dynamic import + full PDF construction in onClick handler.
**Fix:** Download button now calls `/api/generate-pdf` server endpoint first. Converts base64 response to blob for download. Falls back to client-side jsPDF only if server call fails.

---

## Bug Triage Guidelines

### Severity Levels:
- **Critical:** Payment lost, data corruption, security breach → Fix immediately
- **High:** Wrong data shown to user, feature completely broken → Fix within 24h
- **Medium:** Degraded experience, workaround exists → Fix within 1 week
- **Low:** Cosmetic, edge case, minor inconvenience → Fix when convenient

### Before Coding a Fix:
1. Write the **Hypothesis** section — what do you THINK is causing it?
2. Add relevant **Console Error** text
3. List **Affected Files** (narrow the search space)
4. Only THEN start investigating/coding

### After Fixing:
1. Update **Root Cause** (was your hypothesis correct?)
2. Fill in **Fix** description
3. Change **Status** to Fixed
4. Add **Fixed in** reference (commit hash or PR number)

---

*Add new bugs at the top of the "Open Bugs" section. Move to "Fixed Bugs" when resolved.*
