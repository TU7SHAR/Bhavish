# Bug Log

## BhavishAI — Structured Issue Tracker

**Last Updated:** September 2026 (BUG-022 analytics 1000-row cap fixed)

---

## Fixed Bugs (Admin Overview — August 2026)

### BUG-021: Overview stale/cached data — recent paid customer still missing
**Status:** Fixed
**Severity:** High (a real paid customer appeared "missing" from the dashboard)
**Fixed in:** PR #181

**Symptom:** Even after BUG-020 was fixed, a genuine ₹499 Premium payment
(`RPT-1787777020202-0SYZP1`) still didn't appear in the Overview totals, despite
the DB row being perfect (`payment_status=paid`, `plan_tier=premium`, `plan_price=499`).
**Root Cause:** Response caching on both ends:
1. `/api/admin/data` had no dynamic marking, so Next.js 16 could cache/prerender
   the GET handler and serve a STALE snapshot (a count taken before the payment).
2. The client `fetch()` calls had no `cache: "no-store"`, so the browser/CDN
   could also serve an old copy.
**Fix:**
- Added `export const dynamic = "force-dynamic"` + `revalidate = 0` to the admin
  data route (matches the existing pattern in `admin/blog-debug`).
- Added `cache: "no-store"` + a cache-busting `_ts` param to all three client
  fetches of `/api/admin/data` (main `fetchData`, login validation, economics tab).

### BUG-020: Overview dropped recent paid rows past the 1000-row Supabase cap
**Status:** Fixed
**Severity:** High (revenue + paid counts silently under-reported)
**Fixed in:** PR #180

**Symptom:** Recent paid customers were absent from Overview revenue/paid/tier
counts, while still appearing correctly in the Leads/Payments/Paid tabs.
**Root Cause:** The Overview branch used `.select("*")` with NO `.order()` and NO
`.range()`. Supabase caps a single `select()` at **1000 rows** and, with no
ordering, returns the FIRST 1000 in default primary-key order (oldest first).
Once the `reports` table grew past 1000 rows, recent paid rows fell outside that
page and vanished from every Overview metric. Other tabs order by `created_at desc`,
so they still showed those rows — the tell for this bug.
**Fix:** Paginate the fetch in 1000-row pages via `.range()` (order `created_at desc`)
so ALL rows are counted, and select only the lightweight columns the aggregation
needs (dropping heavy JSONB like `sections`/`chart_data`), which also fixed the
slow Overview load.

**Follow-up (RESOLVED):** `/api/admin/analytics` had the same 1000-row cap + no
`force-dynamic`; fixed in BUG-022 (see above).

---

## Fixed Bugs (Admin Actions)

### BUG-019: Admin Actions showed "Unexpected token 'A'... is not valid JSON"
**Status:** Fixed
**Severity:** Medium (admin ops — confusing failure + silent timeout)

**Symptom:** Clicking an Actions button (e.g. "Send First Email to New Leads Only") showed `{"error":"Unexpected token 'A', \"An error o\"... is not valid JSON"}` in the Result box.
**Root Cause:** Two issues combined:
1. `runAction()` called `res.json()` directly. When `/api/manual-send-emails` **timed out**, Vercel returned a non-JSON error page ("An error occurred…"), so `res.json()` threw the cryptic parse error.
2. `/api/manual-send-emails` had **no time budget** (unlike the cron route). On Vercel's free/Hobby tier functions are killed at ~10s, and with a 600ms/lead pace even ~10 leads exceed that → timeout.
**Fix:**
- `runAction()` now reads the response as text and parses defensively, surfacing a clear "action timed out / non-JSON" message with the HTTP status instead of a parse error.
- `/api/manual-send-emails` now stops at an ~8.5s budget (overridable via `?budget=<ms>`), returns valid JSON, and reports `deferredToNextRun` so the admin can click again to continue. No leads are lost.

---

## Fixed Bugs (Analytics — September 2026)

### BUG-022: Analytics tab had the same 1000-row cap + no force-dynamic
**Status:** Fixed
**Severity:** Medium (Analytics tab under-counted once table > 1000 rows; could serve cached data)
**Fixed in:** PR (fix/analytics-1000-row-cap)

**Symptom:** `/api/admin/analytics` fetched reports with `.select(...).order("created_at", desc)`
but no `.range()` pagination, so it only saw the most recent 1000 rows — under-counting
leads, revenue, question categories, sources, and geography once the table grew past
1000 rows. It also lacked `force-dynamic`, so its response could be served stale.
**Root Cause:** Same class of bug as the Overview (BUG-020/BUG-021): Supabase caps a
single `select()` at 1000 rows.
**Fix:** Paginate the fetch in 1000-row pages via `.range()` (order `created_at desc`)
so ALL rows are counted, and add `export const dynamic = "force-dynamic"` +
`revalidate = 0` (matching the Overview route). Verified: the analytics route now
builds as a Dynamic (ƒ) function, same as `/api/admin/data`.

---

## Fixed Bugs (Security — September 2026)

### BUG-024: reportId acted as a bearer credential for full report content
**Status:** Fixed
**Severity:** Medium (report content disclosure by guessing a paid reportId)
**Fixed in:** PR (fix/harden-report-access)

**Symptom:** `/api/generate-full-report` gated only on `payment_status='paid'`
and, for an already-generated report, returned the full `summary` + `sections`
keyed solely on `reportId`. Since `reportId` is `RPT-<timestamp>-<6 chars>` (a
weak identifier, not a secret), anyone who guessed/obtained a paid reportId could
read that customer's full report.
**Root Cause:** No ownership/authorization check — possession of a reportId +
a paid row = access. (A strong 192-bit `access_token` already existed for the
`/report/view/<token>` share links, but the generate endpoint didn't use it.)
**Fix:**
- `verify-payment` now mints (via `ensureAccessToken`) and **returns** the
  report `access_token` to the buyer's browser.
- `generate-full-report` now **requires a matching `access_token`** to return
  already-completed report content (enforced only once a row has a token, so
  legacy rows and the fresh-purchase flow keep working). The buyer's browser
  passes the token it received from `verify-payment`.
- Preserves the no-login product model; the token is the credential, not the
  guessable reportId.

---

## Fixed Bugs (Master Report Delivery — September 2026)

### BUG-025: Master deep-dive generated but never shown on /report/full
**Status:** Fixed
**Severity:** High (₹999 Master customers saw only the ~22-section Premium-looking report)
**Fixed in:** PR (fix/master-deepdive-rehydrate)

**Symptom:** A ₹999 Master purchase whose deep-dive (7 sections + 24-month
roadmap) generated successfully server-side (`deep_dive_status='completed'` in
the DB, sections merged) still displayed only ~22 sections on `/report/full`.
Confirmed on a real report: DB had `plan_tier=master`, `deep_dive_status=completed`,
but the page showed the Premium-style report.
**Root Cause:** `/report/full` rendered ONLY the `sessionStorage` snapshot saved
at payment time (never re-fetched from the DB), and the deep-dive poll was gated
by a fragile `sessionStorage["masterDeepDivePending"]` flag. If the deep-dive
finished after the snapshot was saved, or the page was refreshed / opened on
another device / the flag was missing or the poll hit its 8-attempt (~96s) cap
before Gemini finished, the completed deep-dive in the DB was never loaded.
**Fix:**
- `/report/full` now **re-hydrates from the DB**: for any report that looks like
  Master and lacks deep-dive sections, it calls the idempotent
  `/api/generate-full-report` (authorized with the access token) to pull the
  CURRENT merged sections — so a completed deep-dive appears even after refresh
  or on another device.
- Poll is **no longer gated solely by the sessionStorage flag** — it triggers for
  any Master-looking report missing the deep-dive, raised to ~3 min, and also
  pokes the deep-dive endpoint directly (idempotent, re-claims failed/stale).
- `verify-payment`'s access token + tier are now persisted into `reportData` so
  the re-hydration can authorize the fetch (works with the #194 token gate).

---

## Fixed Bugs (Tracking — September 2026)

### BUG-028: CAPI server Purchase lacked fbp/fbc → browser↔server events not deduped
**Status:** Fixed
**Severity:** Medium (duplicate/"fake" purchases in Meta even with CAPI integrated)
**Fixed in:** PR (fix/capi-fbp-fbc-dedup)

**Symptom:** Even with CAPI integrated, Meta kept reporting duplicate purchases
(e.g. 3 for 1 real sale). Meta's guidance: reliable dedup needs a matching
`event_id` PLUS consistent user identifiers on both events.
**Root Cause:** The server-side CAPI Purchase (`lib/meta-capi.js`) sent only a
hashed email in `user_data` — it did **not** send `fbp`/`fbc` (the `_fbp`/`_fbc`
Meta browser cookies). The `event_id` matched, but without matching fbp/fbc,
Meta's dedup between the browser Pixel event and the server CAPI event is
unreliable, so both get counted.
**Fix:**
- Browser (`report/preview/page.js`) reads `_fbp`/`_fbc` cookies at payment time
  and sends them to `verify-payment`.
- `verify-payment` persists them on the report row as `meta_fbp`/`meta_fbc`
  (migration `008`).
- `fulfillPayment` → `sendPurchaseEvent` includes `fbp`/`fbc` in the CAPI
  `user_data`, so the server event matches the browser event → reliable dedup.
- Works across ALL fulfillment paths (browser/webhook/reconcile) because the
  identifiers are read off the persisted row, not the live request context.
**Owner action:** run migration `008_meta_identifiers.sql`; ensure
`META_CAPI_ACCESS_TOKEN` is set (live CAPI) and `META_TEST_EVENT_CODE` removed.

### BUG-029: Server CAPI Purchase never fired on the normal browser purchase flow
**Status:** Fixed
**Severity:** High (Meta Test Events showed Browser-only Purchase; no Server event → no dedup, unreliable optimisation)
**Fixed in:** PR (fix/capi-purchase-in-verify-payment)

**Symptom:** In Meta Events Manager → Test Events, a real purchase produced a
`Purchase` event `Received from: Browser` ONLY — there was no matching Server
(CAPI) event, so Meta could not deduplicate and server-side conversion signal
was effectively missing on healthy purchases.
**Root Cause:** The server-side CAPI Purchase was only ever sent from
`fulfillPayment()`, which is invoked by `razorpay-webhook` and the
`reconcile-payments` cron. On a normal browser purchase, the webhook can arrive
late and the reconcile cron only runs daily — so at the moment the customer
completes payment, `/api/verify-payment` marked the report paid but never sent
the CAPI event. The browser Pixel fired, the server did not.
**Fix:**
- `verify-payment/route.js` now imports `sendPurchaseEvent` and fires the
  server-side Purchase immediately after the payment is verified + persisted,
  using the SAME `event_id` (`purchase_<reportId>`) as the browser Pixel and the
  persisted `fbp`/`fbc` → Meta receives matched Browser+Server events and merges
  them.
- Idempotent + concurrency-safe: an atomic conditional update claims
  `meta_purchase_sent_at` (only if NULL) before sending, so the webhook/reconcile
  path cannot double-send. If the send fails, the stamp is released so a later
  fulfillPayment path can retry.
**Owner action:** none beyond BUG-028 (same env + migration `008`). Redeploy,
then make one test purchase → Test Events should show Purchase from BOTH Browser
and Server, merged into a single event.

### BUG-031: Paying customers never received their reports (up to TWO MONTHS late)
**Status:** Fixed
**Severity:** CRITICAL (paid customers got nothing; refund/chargeback/reputation risk)
**Fixed in:** PR (fix/paid-report-delivery-backlog)

**Symptom:** A burst of "Your Personalized Vedic Astrology Report" emails went out
on 2026-09-09 04:19-04:20 UTC. The recipients were real customers who had paid in
**July 2026** (valid Razorpay `payment_id`s), whose `email_sent_at` had been `NULL`
for two months. It looked like a mass "resend" but it was actually the FIRST
delivery. At least one paid row (`RPT-1783354001592-KQH9PJ`, paid 2026-07-07) was
still undelivered afterwards.
**Root Cause:** Two compounding defects.
1. **A permanent dead end.** `sweepStuckPaidRows()` only selects rows whose
   `report_status` is null/failed/generating, and then explicitly filters OUT any
   row that is completed-with-sections. A paid row that was COMPLETED but had
   `email_sent_at IS NULL` therefore matched *nothing* — not the sweep, and not
   the Razorpay recent-payments scan once the payment aged out of the latest-100
   window. Those customers could never be recovered by any automated path.
2. **The cron was being killed.** The route does Gemini generation + PDF + email
   inline with `maxDuration = 60`, looping over up to 50 rows with no time
   budget. One report can take 20-40s, so the run 504'd after clearing only a
   row or two. The backlog drained at ~2 customers/day, which is why July
   purchases surfaced in September.
**Fix:**
- New `drainUndeliveredPaidReports()` targets exactly the dead-end state (paid +
  sections already generated + `email_sent_at IS NULL`) and does **no Gemini
  work** — it only renders and emails, ~2-4s per customer. It runs FIRST, before
  any generation, so the backlog is no longer starved by the timeout.
- Added a hard `RUN_BUDGET_MS` (45s) wall-clock deadline honoured by the Razorpay
  scan loop, the backlog drain and the generation sweep. The run now stops
  cleanly and defers the rest to the next run instead of being killed
  mid-generation (which also left rows stuck in `generating`).
- Generation sweep batch lowered 50 → 20; every step remains idempotent.
- Owner "New Sale" emails are suppressed for backlog deliveries via
  `deliverReport(..., { notifyOwnerOfSale: false })` — old money must not
  re-trigger new-sale alerts.
**Owner action:** none. Count the remaining backlog with:
```sql
select count(*) from reports
where payment_status = 'paid' and email_sent_at is null
  and coalesce(plan_tier,'') <> 'master';
```

### BUG-032: deliverReport() never checked payment_status
**Status:** Fixed
**Severity:** High (the paid deliverable could be emailed for free)
**Fixed in:** PR (fix/paid-report-delivery-backlog)

**Symptom:** No confirmed incident, but there was no guard preventing the full
report + PDF from being emailed to a row that was not paid.
**Root Cause:** `/api/send-report-email` only verifies payment for EXTERNAL
callers — `if (!isInternalCall) { ...verify payment_status === "paid"... }`. The
internal path (`sendReportEmail()` → `getInternalAuthHeaders()`) skips that check
entirely by design. `deliverReport()` was the only remaining gate, and it checked
tier and email but **never `payment_status`**. Any bug or manual edit that flagged
a row as deliverable would have shipped the paid product for free.
**Fix:** `deliverReport()` now refuses to send unless `payment_status` is `paid`
or `founder` (intentional free founder-member reports), logs the refusal, and
returns `{ skipped: "not_paid" }`. All skip paths now return a `skipped` reason
for observability.

### BUG-030: Reconcile sweep reported WEEKS-OLD sales to Meta as new purchases
**Status:** Fixed
**Severity:** High (phantom conversions on zero-spend days; corrupts ad optimisation)
**Fixed in:** PR (fix/no-capi-purchase-for-stale-sales)

**Symptom:** Meta Ads Manager showed a **new Purchase on a day with no ad spend**,
attributed as "direct", with no corresponding new payment in Razorpay or the DB.
They appeared one at a time across days, which made it look random and made the
tracking work look broken.
**Root Cause:** `sweepStuckPaidRows()` in `cron/reconcile-payments` selects EVERY
row with `payment_status='paid'` AND `report_status` null/failed/generating —
which includes sales from weeks ago (rows with `paid_at: null`,
`plan_price: null` that predate later migrations). For each it calls
`fulfillPayment()`, whose step 3b runs `maybeSendMetaPurchase()` unconditionally.
That helper's ONLY guard was `if (report.meta_purchase_sent_at) return`. Those
historical rows predate the CAPI feature, so the column was `NULL` → the sweep
fired a **brand-new server-side Purchase event for an ancient sale**. Because it
stamps the column after sending, exactly one old row was "burned" per sweep,
producing a trickle of phantom purchases rather than one obvious burst.
**Fix:** Added a freshness guard to `maybeSendMetaPurchase()`:
- `fulfillPayment` now passes `{ justPaid: !alreadyPaid }`. When this call is the
  one that flipped the row to paid, it is a genuinely new sale → always report.
- Otherwise the row was already paid before this call (sweep/reconcile
  re-touching it), so `paid_at` must be within `PURCHASE_EVENT_MAX_AGE_MS`
  (24h). A `NULL` `paid_at` means the payment time is unknowable → never report.
- Rows that fail the check are **stamped** rather than left `NULL`, so later
  sweeps short-circuit at the existing guard instead of re-evaluating forever.
  Here the stamp means "do not report", not "successfully sent".
- Real recoveries are preserved: a genuinely missed UPI/webhook payment is
  reconciled well within 24h and still reports to Meta.
**Owner action:** one-time backfill so already-existing old sales can never
resurface (the code guard also handles them, but this makes it explicit):
```sql
update reports set meta_purchase_sent_at = now()
where payment_status = 'paid' and meta_purchase_sent_at is null
  and (paid_at is null or paid_at < now() - interval '12 hours');
```

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
