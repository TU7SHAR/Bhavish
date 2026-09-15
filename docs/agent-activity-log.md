# Agent Activity Log

> Chronological record of every agent-driven change to BhavishAI. **Newest entry
> on top.** For each change, capture: what the agent was *asked* to do, how it
> *interpreted* that, what it actually *did/changed*, which *files* were affected,
> and the resulting *impact*.
>
> **Maintenance rule:** add a new entry for every change/iteration. See
> [`DOCS_MAINTENANCE.md`](DOCS_MAINTENANCE.md).

---

## 2026-09-09 — Super-admin Mark Paid + Force Fulfil

**Asked:** "make super admin access like we could mark user paid and then
regenearte option is already there fast" — after seeing two failure modes today:
a payment where the user was marked paid but no sale notification/delivery fired,
and a Razorpay payment where the user was never marked paid.

**Interpreted as:** Ship a fast, safe manual recovery. Root-cause fixes come
later; the user explicitly wanted the operator override now. Regenerate already
exists, so this only needed the mark-paid + fulfil path.

**Did:**
- Added `POST /api/admin/mark-paid` (admin-auth). It delegates to the existing
  idempotent `fulfillPayment()` — the same orchestrator the webhook and cron use
  — so it marks the row paid, resolves the plan (explicit `planId` wins, else the
  row's tier), generates the report only if missing, delivers the email, fires the
  owner notification, and sends the Meta Purchase. Logged as `admin.mark_paid`.
- Added a `markPaid()` handler and buttons in `app/admin/page.js`: unpaid rows get
  a red "Mark Paid — Essential/Premium/Master" override block (failure mode 2);
  paid rows get "Force Fulfil" to re-run delivery + notification without
  regenerating (failure mode 1). Both confirm first.

**Files affected:**
- `app/api/admin/mark-paid/route.js` (new)
- `app/admin/page.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Support can recover a stuck customer in one click instead of a manual
DB edit + reconcile call. Idempotent, so it can't double-fulfil, and it never
overwrites an existing report. Build passes; lint shows only the pre-existing
admin-page errors. No migration (uses the ops_logs table from #217).

**Follow-up NOT in this PR (root causes):** why verify-payment marks paid without
firing the owner notification, and why some Razorpay payments never mark paid at
all. The new ops-log events (`payment.verified`, `webhook.processed`,
`report.delivered`) will help pinpoint both once #217 has run for a day.

**Branch / PR:** `feat/admin-mark-paid` → PR #219.

---

## 2026-09-09 — Instrument the full server surface

**Asked:** "i want all the full logs to lo be logged in table"

**Interpreted as:** Extend #216 beyond `verify-payment` to cover the whole
server-side event surface, so the table fills from normal activity rather than only
when a sale happens. I also re-did the cost maths I had been over-cautious about
earlier: at ~70 leads/day this is roughly 1MB/month, which is negligible against
Supabase's 500MB free tier — so broad logging is genuinely affordable here.

**Did:**
- Funnel instrumentation (the gap that mattered most): `generate-preview` emits
  `funnel.preview_generated` / `_rejected` / `_rate_limited` / `_failed`, and
  `create-order` emits `funnel.order_created` / `_rate_limited` / `_failed`.
  Together with `payment.verified` this gives a durable
  preview → clicked-Pay → paid funnel, which is what was missing when trying to
  explain zero revenue.
- `razorpay-webhook`: `webhook.processed` / `webhook.error` /
  `webhook.unresolved`, plus `webhook.not_configured` as an ERROR because a
  missing secret silently disables the entire safety net while still returning 200.
- `lib/fulfill-payment.js`: `report.delivered` / `report.delivery_failed` /
  `report.delivery_blocked` (BUG-032 guard), `fulfill.legacy_settled` (BUG-031
  guard), `meta.purchase_sent` / `_not_sent` / `_suppressed_stale` (BUG-030 guard).
- Both crons emit a daily heartbeat — `cron.reconcile_run` and `cron.nurture_run`
  with counts, timings and whether the time budget was hit — so the table fills
  every day regardless of sales, and the BUG-031/033 fixes can be verified from
  data.
- Retention: `pruneOpsLogs()` runs inside the reconcile cron and deletes rows
  older than 90 days, avoiding a second cron (Hobby caps them).
- Documented the full event catalogue and the funnel query in
  `commands/cron-and-ops.md`.

**Files affected:**
- `app/api/generate-preview/route.js`, `app/api/create-order/route.js`
- `app/api/razorpay-webhook/route.js`
- `lib/fulfill-payment.js`
- `app/api/cron/reconcile-payments/route.js`, `app/api/cron/send-nurture-emails/route.js`
- `commands/cron-and-ops.md`, `docs/agent-activity-log.md`

**Impact:** The whole funnel and fulfilment path is now durably recorded, so the
next incident is answered with a query instead of a screenshot. Every logging call
is fail-soft, so none of this can break a payment or a delivery.

**Open question left with the user:** whether "full" also means one row per HTTP
request (method/path/status/duration, as the Vercel dashboard shows). That is a
different mechanism — middleware-level — and their illustrating example did not
come through, so it was not assumed.

**Branch / PR:** `feat/log-everything` → PR #217.

---

## 2026-09-09 — Persistent ops logs (Vercel Hobby loses them)

**Asked:** "can we somehow make the logs stay? like vercel needs real pro plan for
seeing older logs butt no budge"

**Interpreted as:** Get durable logs without paying for Vercel Pro. Verified the
constraint first: Vercel documents Log Drains as Pro/Enterprise only, so every
third-party option that plugs in as a drain (Axiom, Better Stack) is unavailable on
Hobby regardless of that vendor's own free tier. The only zero-cost path is for the
app to write its own logs somewhere it already owns — Supabase.

**Did:**
- Added `supabase/migrations/009_ops_logs.sql`: `ops_logs` table with indexes for
  newest-first browsing, per-`report_id` timelines, event-name filtering and a
  partial index for warn/error. RLS enabled with no policy (service-role only).
- Added `lib/ops-log.js` with `logEvent()` / `logWarn()` / `logError()`. Fail-soft
  by contract (never throws, no-ops when the table is absent), mirrors to
  `console` so live `vercel logs` still works, strips secret-looking keys and caps
  `meta` size to protect the 500MB free tier.
- Instrumented `verify-payment` — the highest-value path — with
  `payment.verified`, `payment.signature_invalid`, `payment.order_fetch_failed`,
  `payment.db_update_failed`, `meta.purchase_sent` / `meta.purchase_not_sent` /
  `meta.purchase_failed`. `payment.db_update_failed` matters most: that branch
  returns `success:true` to the customer, so it was previously silent.
- Added `GET /api/admin/logs` (admin-auth, `force-dynamic`) with
  `reportId`/`event`/`prefix`/`level`/`since`/`limit` filters, and a clear hint
  when migration 009 hasn't been run.

**Files affected:**
- `supabase/migrations/009_ops_logs.sql` (new)
- `lib/ops-log.js` (new)
- `app/api/admin/logs/route.js` (new)
- `app/api/verify-payment/route.js`
- `commands/lib-modules.md`, `commands/cron-and-ops.md`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Payment and Meta-tracking incidents become diagnosable after the fact
instead of depending on a screenshot taken in time. Every bug this session
(BUG-026, BUG-030, BUG-031) was slow to find for exactly that reason. Zero added
cost. Fail-soft, so it cannot break a payment.

**Deliberately scoped:** only `verify-payment` is instrumented here.
`fulfillPayment`, `deliverReport` and both crons are the other high-value emitters,
but they are edited by open PRs #215 and #214 — instrumenting them now would create
merge conflicts. That follows once those merge.

**Branch / PR:** `feat/persistent-ops-logs` → PR #216.

---

## 2026-09-08 — Stop the reconcile sweep reporting old sales to Meta (BUG-030)

**Asked:** "another fake purchase ... in meta account it is showing new sale
today when money is not even being spent, direct purchase when there is no
fucking purchase???" — then approval to ship the code fix.

**Interpreted as:** Find the actual mechanism producing Meta Purchase events on
days with zero ad spend and no new payment, and stop it at the source. My first
hypothesis (the user's own test purchase) was WRONG — the pasted Vercel logs
showed a 09:49 `reconcile-payments` 504 alongside a burst of
`send-report-email`/`generate-pdf` calls, which redirected the investigation to
the cron sweep.

**Did:**
- Traced `cron/reconcile-payments` → `sweepStuckPaidRows()` → `fulfillPayment()`
  → step 3b `maybeSendMetaPurchase()` and confirmed the only guard was
  `meta_purchase_sent_at`, which is `NULL` on all pre-CAPI sales.
- Added `PURCHASE_EVENT_MAX_AGE_MS` (24h) and a freshness guard to
  `maybeSendMetaPurchase()`; `fulfillPayment` now passes
  `{ justPaid: !alreadyPaid }` so brand-new sales always report while
  already-paid rows must have a recent `paid_at`.
- Stale rows are stamped so subsequent sweeps short-circuit instead of
  re-evaluating them every run.
- Provided a one-time SQL backfill for existing historical rows.

**Files affected:**
- `lib/fulfill-payment.js`
- `docs/bugs.md` (BUG-030)
- `commands/cron-and-ops.md`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Meta no longer receives fabricated Purchase conversions for sales
that happened weeks earlier, so ad optimisation stops being trained on events
that never occurred and reported purchase counts match reality. Genuine missed
payments recovered by reconcile still report normally (well inside 24h).
Fail-soft behaviour unchanged — nothing here can block fulfilment.
Known follow-ups NOT in this PR: the `reconcile-payments` 60s timeout (it
generates reports + PDFs for up to 50 rows in one invocation) and a 404 on
`/blog/rashi-vs-lagna-chart`.

**Branch / PR:** `fix/no-capi-purchase-for-stale-sales` → PR #212.

---

## 2026-09-09 — Sweep was re-sending reports customers already had (BUG-031, BUG-032)

**Asked:** "paying customers always recieved there report they just were resent i
don't know why look for it also" — correcting my previous conclusion.

**Interpreted as:** My earlier diagnosis was WRONG and had to be reversed. I had
read `email_sent_at IS NULL` on July rows as "never delivered" and opened PR #213
with a `drainUndeliveredPaidReports()` that would have re-emailed every historical
customer in a single run. The user's correction inverted the problem: the customers
were served in July, so the September emails were DUPLICATES.

**Did:**
- Verified with git/PR history that PR #193 (sweep) and PR #195 (`email_sent_at`
  atomic claim) both merged 2026-09-05, so no row paid before that date could ever
  have been stamped. That proves NULL ≠ undelivered for legacy rows.
- **Closed PR #213 unmerged** with a comment explaining the inverted diagnosis, to
  prevent a mass re-send.
- Traced the actual mechanism: the sweep's `completedEnough` test required
  `report_status === "completed"`, so July rows (NULL status, sections present)
  were classified as incomplete, re-claimed via `claim_report_generation` (which
  accepts NULL), re-run through Gemini, and re-emailed because `email_sent_at` was
  NULL. The 20-40s generations also caused the 504s and the few-per-day trickle.
- Switched both the sweep filter and `fulfillPayment` to judge report existence by
  `sections`, not `report_status`.
- Added a historical-sale guard that settles old rows (backfills
  `report_status`/`email_sent_at`, returns `legacy_already_served`) without
  generating or emailing.
- Added `RUN_BUDGET_MS` (45s) so the cron defers instead of being killed.
- Carried over the BUG-032 `payment_status` guard in `deliverReport()`, made
  non-breaking for callers that pass partial rows.

**Files affected:**
- `lib/fulfill-payment.js`
- `app/api/cron/reconcile-payments/route.js`
- `docs/bugs.md` (BUG-031 rewritten with the correct cause, BUG-032)
- `commands/cron-and-ops.md`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Stops duplicate report emails to customers who were already served,
stops pointless Gemini regeneration of existing reports, and removes the cause of
the daily 504. Legacy rows are self-healed as the cron meets them, so the data
converges without manual SQL (optional bulk SQL is documented in `docs/bugs.md`).
Genuine missed payments are unaffected — they reconcile well inside the 7-day
window, and rows with no `sections` are still generated and delivered.

**Lesson recorded:** any recovery mechanism that reaches into historical rows needs
an age guard. This is the third instance of the same class of bug (BUG-026 owner
emails, BUG-030 Meta purchases, BUG-031 report emails).

**Branch / PR:** `fix/sweep-resends-legacy-reports` → PR #215.

---

## Entry template

```
## YYYY-MM-DD — <short title>
**Asked:** <the user's request, verbatim or paraphrased>
**Interpreted as:** <how the agent scoped the task>
**Did:** <the concrete changes made>
**Files affected:** <paths>
**Impact:** <what changed for users/operators/codebase; risks; follow-ups>
**Branch / PR:** <branch name and PR link>
```

---

## 2026-09-07 — Blog post scheduler (1-per-day staggered release)

**Asked:** "Build me the scheduler so the blogs in #200–#204 won't show up at
once but are scheduled 1 per day."

**Interpreted as:** Provide a repeatable way to assign consecutive future
`date`s to the 68 new cluster articles so they auto-publish one/day via the
existing future-date hide gate (#199) — built as a script (not hand-edited
dates) so it works cleanly once the cluster PRs are merged, regardless of order.

**Did:** Added `scripts/schedule-blog-posts.mjs` — rewrites the `date` of the 68
cluster articles (targeted by slug, in a deliberate order: Manglik → Kundli →
Marriage → Career → Wealth → General) to consecutive days from a start date
(default: tomorrow). Options: `--start`, `--per-day`, `--dry-run`. Leaves the
original 9 posts untouched; only edits dates. Added `npm run schedule-blog`
alias and documented usage in `commands/cli-commands.md`. Tested by simulating
the merged state (injected sample posts) — confirmed correct consecutive dates,
originals untouched, and clean restore.

**Files affected:** `scripts/schedule-blog-posts.mjs` (new), `package.json`
(script alias), `commands/cli-commands.md`, `docs/agent-activity-log.md`.

**Impact:** Once #199–#204 are merged, running the script schedules all 68
articles to roll out 1/day — avoiding the "big dump on a young domain" SEO risk.
No runtime code changed; the script only edits blog dates when run.

**Branch / PR:** `feat/blog-post-scheduler` — PR link added on open.

---

## 2026-09-07 — Add repository README.md

**Asked:** "Add a README.md on Bhavish."

**Interpreted as:** Create a top-level `README.md` (none existed) that serves as
the repo's front door — concise overview, stack, quick-start, structure — linking
out to the deeper docs rather than duplicating them.

**Did:** Created `README.md` with: product overview + live link, features,
tech-stack table, getting-started (install/dev/build + env-var highlights + DB
setup), project structure, and a documentation index linking `PROJECT.md`,
`docs/*`, and `commands/`. Used the accurate "high-precision astronomical
calculations" positioning (consistent with the #187/#192 trust fixes), not
"Swiss Ephemeris". Verified all referenced doc paths exist (no broken links).

**Files affected:** `README.md` (new), `docs/agent-activity-log.md` (this entry).

**Impact:** New contributors/visitors get an accurate front door to the repo.
Docs-only change — no runtime code touched.

**Branch / PR:** `docs/add-readme` — PR link added on open.

---

## 2026-09-01 — Sync all docs with code + establish living-docs system

**Asked:** "Update all the docs and all md files for the project, and each
iteration should update them."

**Interpreted as:** (1) Correct every markdown doc that had drifted from the
current code; (2) stand up the living-documentation system this project expects —
a `commands/` reference folder, this agent activity log, and an automated
per-iteration reminder — so docs stay current on every future change.

**Did:**
- Audited `PROJECT.md` + all eight `docs/*.md` against the actual source
  (routes, lib, components, `vercel.json`, geocoder).
- **PROJECT.md:** corrected geocoder (Nominatim, not Google Maps) in 3 places;
  updated the `generate-full-report` row (now payment-gated + atomic claim);
  rebuilt the "Technical Weak Points" section into **Resolved** (10, verified) vs
  **Genuinely Open** (10); fixed the Known Limitations table (timezone, backups);
  corrected the cron block; added a "Living Documentation Policy" section and doc
  index entries.
- **docs/:** `architecture.md` — added `MonthlyGuidanceSection.js` + `RichText.js`
  components and 5 missing lib modules; version 1.2. `prd.md` — fixed the
  "no data export" constraint (export exists), v1.1. `requirements.md` v1.1.
  `audit.md` — added a Sept-2026 re-verification note (BUG-022 still open).
  `implementation_plan.md` v1.1, `testing.md` + `bugs.md` date refresh.
- **commands/** (new): `README.md`, `cli-commands.md`, `api-routes.md` (all 42
  routes, incl. 10 previously-undocumented admin routes), `lib-modules.md` (all 19
  modules), `pages.md`, `cron-and-ops.md`.
- **docs/DOCS_MAINTENANCE.md** (new) + **.kiro/hooks/docs-maintenance-reminder.json**
  (new) — the per-iteration doc-update contract and its automated reminder.

**Files affected:**
- `PROJECT.md`
- `docs/architecture.md`, `docs/prd.md`, `docs/requirements.md`, `docs/audit.md`,
  `docs/bugs.md`, `docs/testing.md`, `docs/implementation_plan.md`
- `docs/agent-activity-log.md` (this file, new)
- `docs/DOCS_MAINTENANCE.md` (new)
- `commands/README.md`, `commands/cli-commands.md`, `commands/api-routes.md`,
  `commands/lib-modules.md`, `commands/pages.md`, `commands/cron-and-ops.md` (new)
- `.kiro/hooks/docs-maintenance-reminder.json` (new)

**Impact:** Docs now match the shipped code, removing several misleading "open
critical issue" claims that were already fixed (payment gating, paywall, rate
limiting, timezone, unsubscribe). New contributors (human or agent) get an
accurate route/lib/page reference and a clear, enforced rule to keep docs current.
Docs-only change — no runtime code touched. Follow-up: BUG-022 (analytics
1000-row cap) and `RAZORPAY_WEBHOOK_SECRET` remain open and are now clearly tracked.

**Branch / PR:** `docs/sync-with-code-and-maintenance-system` →
[PR #184](https://github.com/TU7SHAR/Bhavish/pull/184).

---

*This is the first entry. All prior history lives in git and the per-PR notes in
`docs/bugs.md` / `docs/task.md`.*



## 2026-09-15 — SEO CTR optimisation round 1

**Asked:** "research on the articles we need to improve or better or add new
articles" + a Search Console 3-month Pages/Queries export. "do a thorough fix".

**Interpreted as:** Use the real GSC data to find where clicks leak and fix the
highest-ROI items. Key realisation from the data: the biggest-traffic articles
(lagna-chart-vs-moon-chart 689 impressions/0.6% CTR, sade-sati 151 impr/0 clicks)
are DB `blog_posts` rows, and there was NO way to edit an existing DB article's
title/meta — only to generate new ones.

**Did:**
- `app/blog/[slug]/page.js`: replaced the blind `related = slice(0,3)` with a
  relevance-scored "Read next" (shared keywords + title words), so internal links
  point to genuinely related articles and pass ranking equity where it helps.
- New `POST /api/admin/update-article`: edit an existing DB article's
  title/description/keywords/content/published, with SEO length guardrails
  (title 15-70, description 50-165). This is what makes the click-leak fixes
  possible on the pages that already rank.
- `lib/blog-posts.js`: retitled the Chandra Kundli article to lead with "Moon
  chart" (the English query "what is moon chart" had 50 impressions and wasn't
  matching the Sanskrit-led title); expanded its keywords.
- `docs/seo-ctr-action-plan.md`: paste-ready `update-article` commands for the
  top DB pages (lagna-vs-moon, sade-sati, rashi-vs-lagna, predict-your-future,
  mesh-rashi), a duplicate-article consolidation list (Saturn, kundli-matching,
  rashi-vs-lagna cannibalisation), and the next new-article targets (per-rashi
  love-life cluster, the proven winner).

**Files affected:**
- `app/blog/[slug]/page.js`
- `app/api/admin/update-article/route.js` (new)
- `lib/blog-posts.js`
- `docs/seo-ctr-action-plan.md` (new)
- `docs/agent-activity-log.md` (this entry)

**Impact:** Better internal linking now; the ability to fix the highest-traffic
DB titles/metas (biggest CTR lever); "moon chart" query now matched. Build +
eslint pass. Note: the largest single win (lagna-vs-moon 689 impr) requires
running the documented `update-article` command against production, since that
content lives in the DB, not the repo.

**Branch / PR:** `feat/seo-ctr-optimization-round1` → PR #221.



## 2026-09-15 — Admin UI: inline SEO editor for blog articles

**Asked:** After PR #221 added the update-article endpoint, the user chose "build
the admin UI editor first (no terminal ever)" over running curl.

**Interpreted as:** Give the Blog tab an inline editor so DB article titles/metas
(the biggest CTR lever — lagna-vs-moon 689 impr, sade-sati 151 impr) can be
rewritten from the admin panel without curl or exposing the admin secret.

**Did:**
- Refactored each blog row in `BlogTab` into a new `BlogRow` component with an
  "✏️ Edit SEO" button that reveals inline title + meta-description fields.
- Live SEO length hints (title 15-70, description 50-165) turn green/amber; Save
  is disabled until both are in range — matching the endpoint's guardrails.
- Save calls `POST /api/admin/update-article` with the admin bearer token already
  in the panel; refreshes the list on success.
- Branched off `feat/seo-ctr-optimization-round1` (#221) because it needs that
  endpoint, so this PR is self-contained.

**Files affected:**
- `app/admin/page.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** The highest-ROI SEO action (rewriting titles/metas of ranking DB
articles) is now a UI task, not a terminal task. Build passes. Merge order: #221
first, then this.

**Branch / PR:** `feat/admin-blog-seo-editor` → PR #222.



## 2026-09-15 — Serve /.well-known/traffic-advice properly

**Asked:** "make .well-known file fully professional one" — the Chrome Private
Prefetch Proxy was hitting `/.well-known/traffic-advice` and getting a 404.

**Interpreted as:** Turn the 404 into a correct, spec-compliant traffic-advice
response so Chrome's prefetch proxy is explicitly allowed to prefetch the site.

**Did:**
- Added `app/.well-known/traffic-advice/route.js` — a `force-static` GET that
  returns the spec JSON array (`user_agent: "prefetch-proxy"`, `fraction: 1.0`,
  plus the `google_prefetch_proxy_eap` block) with Content-Type
  `application/trafficadvice+json` (the proxy rejects generic application/json)
  and an aggressive immutable cache header.
- Verified locally: 200, correct content-type, correct body. Build registers it
  as a static route; the proxy matcher does not block `.well-known`.

**Files affected:**
- `app/.well-known/traffic-advice/route.js` (new)
- `docs/agent-activity-log.md` (this entry)

**Impact:** The 404 becomes a 200; Chrome users may get faster prefetched loads
(a small Core Web Vitals / UX win). Purely additive. Build passes. NOTE: separate
follow-up still worth doing — the http_logs logger records bot/`.well-known`
noise and fired 3× on that request; deduping + bot-skipping it is the real
resource optimisation.

**Branch / PR:** `feat/well-known-traffic-advice` → PR #223.



## 2026-09-15 — LLM resilience: multi-model fallback in generateWithRetry (BUG-fix for Gemini 503s)

**Asked:** After Gemini 3.1 Flash Lite threw repeated 503 "high demand" errors
(breaking generate-email-sequence and draft-reply on 2026-09-15), add a fallback.
User constraints, in order: no money (free only); 3.1 Flash Lite MUST stay
primary because it has the best astrology "roleplay" voice; prefer a hedged
parallel-on-failure approach; "don't add new bugs."

**Interpreted as:** Enhance the ONE shared wrapper (`generateWithRetry`) that
every AI route already calls, so all routes gain fallback with zero call-site
changes and zero new bug surface. Never switch models to chase quality — only
on 503/unavailable, ordered by tonal closeness to the primary.

**Did:**
- Rewrote `lib/gemini-retry.js`, keeping the exact `generateWithRetry(model,
  prompt, maxRetries)` signature. Behaviour:
  1. primary model, retried with existing backoff;
  2. on 503 only → HEDGE: race a fresh primary attempt vs the closest sibling
     (`gemini-3.5-flash-lite`), preferring the primary's result within a 1.5s
     grace window so its voice wins when merely slow;
  3. then sequential remaining fallback (`gemini-3.8-flash`);
  4. exhausted → throw last error (identical to old behaviour).
- FAIL-SAFE BY CONSTRUCTION: if the model name can't be introspected, or a
  non-503 error occurs, it behaves EXACTLY like the old wrapper (no fallback).
  Verified `m.model` / `m.generationConfig` exist on the installed SDK.
- Verified with a standalone test (removed after): success passthrough uses only
  the primary (1 call, voice preserved); non-503 errors throw immediately (real
  bugs not masked); no-name+503 degrades to a safe throw.
- No route files changed. No new env keys. All free (same Gemini key).

**Files affected:**
- `lib/gemini-retry.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** The 2026-09-15 outage class (single-model 503) is now survived by
falling to a sibling free model, while healthy days still use only 3.1 Flash Lite
— same voice, same token cost. Build + eslint pass. Fallback order is a config
array (`FALLBACK_CHAIN`) for easy tuning.

**Branch / PR:** `feat/llm-multi-model-fallback` → PR #224.



## 2026-09-15 — Extend LLM fallback to draft-reply + analytics categorization

**Asked:** "add same fallback for ai emails as well" — after PR #224 added the
multi-model fallback to the shared wrapper.

**Interpreted as:** Find AI routes that call Gemini DIRECTLY (bypassing
generateWithRetry) and route them through the wrapper so they get the same 503
fallback. Audited with grep: `draft-reply` (the AI email drafter — one of the
routes that 503'd on 2026-09-15) and `analytics` categorizeWithAI both called
`model.generateContent()` directly.

**Did:**
- `draft-reply`: now calls `generateWithRetry(model, {...})`. It passes a full
  request object with `systemInstruction`, so I first confirmed the wrapper
  forwards the argument to `generateContent` unchanged (generateContent accepts
  string OR request object), then documented that in the wrapper. Verified with a
  test that the `systemInstruction` is preserved byte-for-byte across the
  fallback → no prompt discrepancy.
- `analytics` categorizeWithAI: swapped its direct call for `generateWithRetry`.
- Clarified the wrapper's JSDoc/param to state it accepts a string OR a request
  object and forwards it identically to every model.

**Files affected:**
- `lib/gemini-retry.js` (doc/param clarity only — no behaviour change)
- `app/api/admin/draft-reply/route.js`
- `app/api/admin/analytics/route.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Every AI route now has the same voice-preserving 503 fallback,
including the AI email drafter. Build + eslint pass; object-form forwarding
verified. Branches off #224, so merge #224 first.

**Branch / PR:** `feat/llm-fallback-emails-analytics` → PR #225.



## 2026-09-15 — Broadcast email feature + Overview unique-people count

**Asked:** Build a broadcast-email button that sends to filtered segments, with
AI email generation and filters (date range, paid/free, gender, tier, guidance).
Mid-build steering: also show unique-people count under the Overview's 1303
total ("add small bracket like 1100 unique people").

**Interpreted as:** The user confirmed "no money" (Resend free tier) and 1,302
contacts > Resend's 1,000-contact cap, so native Broadcasts/Audiences can't hold
everyone. Chose Path B + safety: filter & de-dup in OUR DB, send via the normal
Resend emails.send in a paced loop with a HARD per-send cap so a blast can never
starve report-delivery email quota. Every email carries an unsubscribe link;
unsubscribed users are excluded at the filter layer.

**Did:**
- `lib/broadcast-filters.js` — shared `selectRecipients()`: paginated fetch,
  filters (status/tier/gender/guidance/date range), excludes unsubscribed,
  de-duplicates by email. One source of truth for preview + send.
- `POST /api/admin/broadcast-preview` — returns unique matched count + sample,
  no send. Powers the live count.
- `POST /api/admin/broadcast-generate` — AI subject+body via `generateWithRetry`
  (same 3.1-flash-lite voice + 503 fallback), editable before send.
- `POST /api/admin/broadcast-send` — paced send (600ms gap), `MAX_PER_SEND`
  cap (default 80, env-tunable), unsubscribe link on every email, logs
  `admin.broadcast_sent` to ops_logs. Requires `confirm:true`.
- Admin UI: new "📢 Broadcast" tab (filters → live preview → AI/manual compose →
  send with confirm). Hoisted `BroadcastSelect` to module scope to avoid
  remount/focus-loss.
- Overview: added `uniquePeople` (de-dup by email) to the data API and rendered
  it as "(N unique people)" beside Total Leads — answers the "is 1303 real
  people or duplicates?" question directly.

**Files affected:**
- `lib/broadcast-filters.js` (new)
- `app/api/admin/broadcast-preview/route.js`, `broadcast-generate/route.js`, `broadcast-send/route.js` (new)
- `app/admin/page.js` (Broadcast tab + BroadcastSelect + Overview unique count)
- `app/api/admin/data/route.js` (uniquePeople)
- `docs/agent-activity-log.md` (this entry)

**Impact:** Filtered, de-duplicated broadcast emails with AI generation, safe on
the free tier (never exceeds a per-send cap, never touches Resend audiences, never
mails unsubscribers). Overview now shows real human count. Build passes; page.js
error count went 25 → 21 (hoisting removed some; my code added none). No migration.

**Known limit (by design):** sends >80 per click hold the remainder back — send
again later or narrow the filter; a true "all 1302 at once" needs a Resend upgrade.

**Branch / PR:** `feat/admin-broadcast` → PR #226.



## 2026-09-15 — Gift a free Essential (₹299) report (no revenue / no CAPI / no sale notification)

**Asked:** "add a gift 299 report in manual upgrade section but it shouldn't fire
CAPI or reflect in payments — since it is gifted, not actually paid."

**Interpreted as:** Add a `gift_essential` path that delivers a real Essential
report for free while being invisible to revenue, Meta CAPI, and the owner sale
notification.

**Did:**
- `app/api/admin/gift/route.js`: new `type: "essential"`. Sets
  `payment_status: "gifted"` (NOT "paid"), `plan_price: 0`,
  `is_essential_gifted: true`. Because all revenue is summed only over
  `payment_status === "paid"` rows, a gifted report is automatically excluded
  from every revenue/payment metric — no analytics change needed. Then it
  generates the 10-section Essential report inline (via the shared
  `generateFullReport`, only if the row doesn't already hold one) and delivers it
  through `deliverReport(..., { notifyOwnerOfSale: false })`. The path NEVER calls
  `sendPurchaseEvent` (CAPI) and NEVER calls `notify-sale`. Guards against
  gifting over a genuinely PAID row. `maxDuration` raised 15 → 60 for generation.
- `lib/fulfill-payment.js`: `deliverReport` payment guard now also allows
  `"gifted"` (alongside paid/founder) so the gifted report can be emailed; still
  excluded from revenue since it isn't "paid".
- `app/admin/page.js`: added a green "🎁 Gift Essential Report (free)" button in a
  dedicated block under the (red) Mark-Paid override, shown for unpaid rows, with
  copy stating it's not a sale / no revenue / no Meta Purchase. Wired
  `gift-essential` into the action url/success/body maps.

**Files affected:**
- `app/api/admin/gift/route.js`
- `lib/fulfill-payment.js`
- `app/admin/page.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Support can gift a full free report to a lead; it's delivered by email
but stays out of revenue, Meta, and sale notifications. Build + eslint pass.
NOTE: `is_essential_gifted` is a new column on `reports` — it is written via the
progressive pattern, but for it to persist you must add it:
`ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_essential_gifted BOOLEAN DEFAULT false;`
(If the column is missing the update will error; see owner action.)

**Branch / PR:** `feat/gift-essential-report` → PR #227.



## 2026-09-15 — Gifted Essential now sends a "you've been gifted" email

**Asked:** "the gifted person should get the mail that they have been gifted
something, whatever I gift them."

**Interpreted as:** The gifted Essential path (PR #227) sent only the report, no
gift framing — so it felt like an ordinary delivery. Send the gift-notification
email too. (guidance/founder/premium/master already send their gift emails.)

**Did:**
- `app/api/admin/gift/route.js`: in the `essential` branch, BEFORE generating the
  report, send the "🎁 A free personalized report for you" notification (using the
  existing `buildGiftEmail` essential copy), then generate + deliver the report as
  before. So the customer gets: (1) a gift email telling them it's a gift, then
  (2) the report itself. Still no revenue, no CAPI, no owner sale notification.
- Response now reports both `emailSent` (report delivered) and `giftEmailSent`.

**Files affected:**
- `app/api/admin/gift/route.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Gift recipients are told they've been gifted a free report, not just
handed a report silently. Build + eslint pass. Branches off #227 (needs the
essential gift path) — merge #227 first, then this.

**Branch / PR:** `feat/gift-essential-notify-email` → PR #228.



## 2026-09-15 — FIX: gifted Essential wrongly fired the owner "New Sale" notification

**Asked:** Owner reported (correctly, angrily) that gifting an Essential report
sent them a sale notification.

**Root cause (my bug):** The gift code called
`deliverReport(supabase, full, generated, { notifyOwnerOfSale: false })`, but the
DEPLOYED `deliverReport` signature was `(supabase, report, generated)` — it had NO
options parameter. The `notifyOwnerOfSale` option originated in PR #213, which was
CLOSED UNMERGED, so it never actually landed in `deliverReport`. The 4th argument
was silently ignored and `deliverReport`'s unconditional `notifyOwner()` ran →
spurious "New Sale" email.

**Confirmed NOT affected:** CAPI did NOT fire (deliverReport contains no
sendPurchaseEvent — CAPI only fires from verify-payment/fulfillPayment on real
payments). Revenue NOT affected (payment_status="gifted", plan_price=0). The only
leak was the owner email — cosmetic, no money/Meta impact.

**Did:**
- `lib/fulfill-payment.js`: added the missing `options` param to `deliverReport`
  — `deliverReport(supabase, report, generated, { notifyOwnerOfSale = true } = {})`
  — and gated the `notifyOwner(...)` call behind it. Defaults true, so every real
  payment path is unchanged; the gift path (already passing false) now correctly
  suppresses the sale notification.
- Verified the gift endpoint already passes `{ notifyOwnerOfSale: false }`.

**Files affected:**
- `lib/fulfill-payment.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** Gifted reports no longer trigger the owner "New Sale" email. Build +
eslint pass. Lesson: don't assume an option exists because an earlier (closed) PR
added it — verify the deployed signature.

**Branch / PR:** `fix/gift-suppress-owner-notify` → PR #229.



## 2026-09-15 — Manglik: distinguish traditional vs secondary Venus-based condition

**Asked:** A chart clean from Ascendant AND Moon but flagged only by the
Venus-based rule should NOT say "You are Manglik / should be cautious." Show it as
a SECONDARY (Venus-Manglik) condition, badge "SECONDARY CONDITION" (not
"CANCELLED"), and drop the alarming sentence.

**Interpreted as:** Fix at the deterministic source (`computeManglik`) so every
surface (paid report, founder report, free tool, preview) is corrected at once,
then reinforce the LLM instruction so the report prose matches.

**Did:**
- `lib/vedic-calculator.js` `computeManglik`: now classifies three outcomes —
  `category: "none" | "traditional" | "secondary_venus"`. Traditional = Mars in a
  dosha house from Lagna OR Moon. Venus-only (clean from Lagna+Moon) =
  `secondary_venus`. Added `isTraditionalManglik` / `isSecondaryOnly`. The summary
  the LLM is forced to follow now explicitly says, for the secondary case, "NOT
  traditional Manglik… present as a secondary condition, do NOT say 'you are
  Manglik' flatly, do not alarm or demand strict matching/remedies." `isManglik`
  kept for backward-compat (true for secondary too) but callers should read
  `category`.
- `app/api/tools/manglik/route.js`: returns `category` / `isTraditionalManglik` /
  `isSecondaryOnly`.
- `app/tools/manglik-calculator/ManglikCalculator.js`: three-way result — amber
  "Manglik", blue "Secondary Condition — Venus-Manglik indication" (with a "not
  traditional Manglik — clear from Ascendant and Moon" note), green "Not Manglik".
- `lib/report-generation.js` + `app/api/founder/generate/route.js`: strengthened
  the MANGLIK INSTRUCTION to handle the secondary case and forbid the flat
  "you are Manglik and should be cautious" line.

**Files affected:**
- `lib/vedic-calculator.js`
- `app/api/tools/manglik/route.js`
- `app/tools/manglik-calculator/ManglikCalculator.js`
- `lib/report-generation.js`
- `app/api/founder/generate/route.js`
- `docs/agent-activity-log.md` (this entry)

**Impact:** A Venus-only chart is now shown as a secondary, less-severe condition
everywhere, never a flat "you are Manglik." Verified the classifier with a
standalone test (secondary_venus / traditional / none all correct for the exact
scenarios). Build + eslint pass. No migration (deterministic compute, no schema).

**Branch / PR:** `feat/manglik-secondary-venus-condition` → PR #232.
