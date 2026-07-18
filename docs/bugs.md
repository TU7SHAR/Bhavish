# Bug Log

## BhavishAI — Structured Issue Tracker

**Last Updated:** July 2026 (regenerate-tiers + markdown pass)

---

## Fixed Bugs (This Session — regenerate tiers + markdown rendering)

### BUG-016: Vercel deploy failing — unclosed `<div>` in preview paywall
**Status:** Fixed
**Severity:** Critical (blocked all deploys)

**Symptom:** `next build` failed with `./app/report/preview/page.js:894 Expected '</', got 'jsx text'`. Every Vercel deployment failed.
**Root Cause:** The blurred-background paywall refactor left the `<div className="relative">` wrapper (the locked-sections background + CTA overlay container) unclosed — 56 opening `<div>` vs 55 `</div>`.
**Fix:** Added the missing `</div>` after the CTA wrapper closes (below the "Secure Razorpay payment" trust line). Build is green again.

### BUG-017: Raw `**markdown**` asterisks shown to customers
**Status:** Fixed
**Severity:** Medium (visible quality issue)

**Symptom:** Reports, guidance packs, PDF and emails showed literal `**bold**`, `##` and `*` characters because Gemini emits light Markdown and the frontend rendered it raw via `whitespace-pre-line`.
**Root Cause:** No Markdown rendering layer; content was dropped straight into the DOM / email HTML / PDF text.
**Fix:** New `lib/markdown.js` (`mdToHtml` for HTML contexts, `mdToPlain` for PDF) plus a shared `app/components/RichText.js`. Converts `**bold**`/`__bold__` → `<strong>`, `#` headings → bold, `- `/`* ` → bullets, preserves line breaks, escapes HTML, and strips any stray asterisks. Wired into every report/guidance render surface: report full/preview/view-token, dashboard report, admin report view, GuidancePack, MonthlyGuidanceSection, and the report/resend/guidance email HTML + the PDF.

### BUG-018: "Regenerate" always produced a 30+ section report regardless of tier
**Status:** Fixed
**Severity:** Medium (admin ops / wrong deliverable)

**Symptom:** The single admin "Regenerate Full Report" button always generated the full 20-section report even for ₹299 Essential customers, so admins couldn't rebuild the exact package a customer paid for.
**Root Cause:** `regenerate-report` hard-coded a 20-section prompt and ignored the plan.
**Fix:** `regenerate-report` is now tier-aware — it reuses the shared `generateFullReport` + `generateDeepDive` + `resolvePlan`, accepts `{ reportId, tier, includeGuidance }`, and Master does a two-phase save (main report persisted first, then the deep-dive appended; partial failures are recoverable). Admin UI now has explicit **Regen Essential ₹299 / Essential+Guidance ₹448 / Premium ₹499 / Master ₹999** buttons.

---

## Open Bugs

### BUG-010: Analytics leak on private report links
**Status:** Open (accepted risk)
**Severity:** Low
**Discovered:** July 2026

**Symptom:** `/report/view/[token]` pages fire GA/Meta Pixel, meaning the secret token URL is sent to analytics providers.
**Root Cause:** Layout.js loads analytics globally; Next.js App Router doesn't support per-route exclusion without a layout group refactor.
**Mitigation:** Token is 192-bit (unguessable from logs); page has `robots: noindex, nofollow`; no PII is attached to the analytics hit. Actual risk is negligible.
**Fix:** Would require a `(private)` route group with a separate layout excluding analytics. Deferred — not worth the complexity for the current risk level.

---

## Fixed Bugs (This Session — PR #153)

### BUG-011: save-report accepts paymentStatus from client (PAYWALL BYPASS)
**Status:** Fixed
**Severity:** Critical
**Fixed in:** PR #153

**Symptom:** Anyone could call `/api/save-report` with `paymentStatus: "paid"` and then call `/api/generate-full-report` to get the report without paying.
**Root Cause:** The public endpoint accepted `paymentStatus`, `paymentId`, `reportStatus`, `plan_tier`, `plan_price` from the request body and wrote them using the service-role client.
**Fix:** Stripped ALL payment/plan fields from the public endpoint. Forces `payment_status: "unpaid"` always. Only verified server-side code (verify-payment, webhook, fulfillPayment) can mark paid.

### BUG-012: verify-payment trusts client-sent planId (TIER SPOOFING)
**Status:** Fixed
**Severity:** Critical
**Fixed in:** PR #153

**Symptom:** A ₹299 payment could be verified as "master" (₹999) because the client sent `planId` in the request body and the server used it directly.
**Root Cause:** The endpoint resolved the plan from `request.json().planId` instead of from Razorpay's server-set order notes.
**Fix:** Now fetches the Razorpay order by `razorpay_order_id` (server-to-server) and derives `reportId`, `planId`, `guidanceMonths`, and `amount` from `order.notes` — which were set by `create-order` and cannot be tampered with by the client.

### BUG-013: generate-full-report uses client-supplied birth data
**Status:** Fixed
**Severity:** High
**Fixed in:** PR #153

**Symptom:** Wrong report details from stale localStorage, multiple tabs, or intercepted requests.
**Root Cause:** The endpoint accepted `name`, `dateOfBirth`, `timeOfBirth`, `placeOfBirth`, `chartData`, `personalQuestion` from the request body instead of loading them from the database.
**Fix:** Now accepts ONLY `{ reportId }`. Loads ALL data from Supabase (the single source of truth). Client can no longer supply or manipulate birth details after payment.

### BUG-014: Browser + webhook double-generate reports (race condition)
**Status:** Fixed
**Severity:** High
**Fixed in:** PR #153

**Symptom:** Two simultaneous Gemini calls → two slightly different reports → two emails → last DB write wins.
**Root Cause:** No atomic lock. Both paths checked `report_status === "completed"` but didn't claim a "generating" slot.
**Fix:** Added atomic generation locking. `generate-full-report` sets `report_status = "generating"` (with `.neq("report_status", "generating")` guard). Returns 409 if already claimed. `fulfillPayment` now also returns `already_generating` if the browser already claimed the slot.

### BUG-015: Master customer emailed before deep-dive finishes
**Status:** Fixed
**Severity:** High
**Fixed in:** PR #153

**Symptom:** ₹999 Master customer receives email with only the Premium-style 20-section report. The 7 deep-dive sections + 24-month roadmap arrive later (or never, if the fire-and-forget fails).
**Root Cause:** `fulfillPayment` sent the email immediately after the main report, then triggered the deep-dive as a separate fire-and-forget job.
**Fix:** For Master tier, the email is now HELD until the deep-dive endpoint completes. The deep-dive endpoint sends the final email with all 30 sections merged. Essential/Premium still get immediate email (they're complete after the main generation).

### BUG-016: Founder purchase APIs still active
**Status:** Fixed
**Severity:** Medium
**Fixed in:** PR #153

**Symptom:** `/api/create-upgrade-order` and `/api/verify-upgrade` still process ₹999 Founder purchases even though the UI retired them.
**Fix:** Both endpoints now return `410 Gone` with a clear message. Existing Founder generation (`/founder/new`) continues working for grandfathered members.

### BUG-017: Form sends unsanitized formData (not cleanData)
**Status:** Fixed
**Severity:** Medium
**Fixed in:** PR #153

**Symptom:** `get-report/page.js` creates a `cleanData` object with HTML stripped, but then sends the original `formData` to the API and stores it in sessionStorage.
**Fix:** Changed to `JSON.stringify(cleanData)` for both the API call and storage.

### BUG-018: Zod schema defined but never called
**Status:** Fixed
**Severity:** Medium
**Fixed in:** PR #153

**Symptom:** `generate-preview/route.js` defines `inputSchema` with Zod but never calls `.parse()` or `.safeParse()` — validation is cosmetic.
**Fix:** Added `inputSchema.parse(rawBody)` with a try/catch that returns the first Zod error message as a 400 response.

### BUG-019: Founder monthly limit defaults to unlimited
**Status:** Fixed
**Severity:** Low
**Fixed in:** PR #153

**Symptom:** The my-plans page shows "5 reports/month" but the generation endpoint defaults to `FOUNDER_MONTHLY_LIMIT = 0` (unlimited).
**Fix:** Changed default from `"0"` to `"5"` (contractual promise). Still overridable via env var.

---

## Previously Fixed Bugs (Earlier PRs)

- BUG-001: Mercury/Venus in impossible signs (heliocentric → geocentric fix)
- BUG-002: LLM contradictory Manglik/Yoga verdicts (deterministic computation)
- BUG-003: IST hardcoding (timezone from longitude, PR #148)
- BUG-004: UPI payments showing as "unpaid" (webhook + fulfillment safety net)
- BUG-005: In-memory rate limiter ineffective (Supabase-backed, PR #148)
- BUG-006: PDF only available from browser (server-first download, PR #148)
- BUG-007: email undefined in send-report-email (PR #151)
- BUG-008: Footer covered by paywall overlay (PR #151)
- BUG-009: Deep-dive styling on non-Master reports (PR #151)

---

*Add new bugs at the top of "Open Bugs". Move to "Fixed Bugs" when resolved.*
