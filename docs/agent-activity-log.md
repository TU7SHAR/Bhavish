# Agent Activity Log

> Chronological record of every agent-driven change to BhavishAI. **Newest entry
> on top.** For each change, capture: what the agent was *asked* to do, how it
> *interpreted* that, what it actually *did/changed*, which *files* were affected,
> and the resulting *impact*.
>
> **Maintenance rule:** add a new entry for every change/iteration. See
> [`DOCS_MAINTENANCE.md`](DOCS_MAINTENANCE.md).

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

## 2026-09-09 — Nurture emails per person, not per row (BUG-033)

**Asked:** Part of "fix whatever the issues are" — specifically the observation
that "a stupid lady had made more then 30+ get report" and that many emails went
out.

**Interpreted as:** Stop one person with many duplicate lead rows from receiving
many parallel nurture sequences, without changing the intended schedule for
genuine single-row leads.

**Did:**
- Grouped the fetched rows by normalised email, keeping the oldest row per person
  as the sequence owner.
- Marked the surplus rows `email_sequence_status = 'duplicate'` and added
  `duplicate` to the fetch query's exclusion list so they are retired for good.
- Made the 6h cooldown per-person by taking the max `last_email_sent_at` across
  all rows sharing that email.
- Fixed the time-guard `skippedForTime` maths to use the deduplicated list.
- Extended the JSON response with `rowsFetched` / `uniquePeople` /
  `duplicatesRetired`.

**Files affected:**
- `app/api/cron/send-nurture-emails/route.js`
- `docs/bugs.md` (BUG-033)
- `docs/agent-activity-log.md` (this entry)

**Impact:** A person receives at most one nurture sequence regardless of how many
times they submit the form. Protects the Resend quota and sender reputation, which
directly protects deliverability of the PAID report emails. Build and targeted
lint pass. Deliberately NOT included: a per-email cap on lead creation itself
(still allows duplicate rows and wasted Gemini calls) — left as an open item so
this PR stays reviewable.

**Branch / PR:** `fix/nurture-emails-per-person` → PR #214.

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
