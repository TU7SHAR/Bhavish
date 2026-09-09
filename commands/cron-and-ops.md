# Cron Jobs & Operations

Scheduled jobs and manual operational endpoints, and how to trigger them safely.

---

## Scheduled crons (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/send-nurture-emails", "schedule": "0 3 * * *" },
    { "path": "/api/cron/send-nurture-emails", "schedule": "30 15 * * *" },
    { "path": "/api/cron/reconcile-payments",  "schedule": "0 * * * *" }
  ]
}
```

| Job | Schedule (UTC) | IST | What it does |
|-----|----------------|-----|--------------|
| `cron/send-nurture-emails` | `0 3 * * *` | ~8:30 AM | Send next-due nurture email per lead. 9s budget, 6h cooldown. |
| `cron/send-nurture-emails` | `30 15 * * *` | 9:00 PM | Second daily nurture pass. |
| `cron/reconcile-payments` | `0 * * * *` | hourly | Self-heal missed payments (idempotent). |

> **Vercel Hobby caveat:** free-tier crons fire only **once per day**, so the
> hourly reconcile won't truly run hourly. Use an external trigger
> (**cron-job.org**) with a custom `Authorization: Bearer <CRON_SECRET>` header
> for sub-hourly / header-authed triggering. See `docs/cron-setup.md`.

All cron endpoints require `verifyCron()` (`CRON_SECRET`).

### Reconcile sweep — legacy rows must never be regenerated (BUG-031)

**`sections` is the source of truth for "does a report exist" — never
`report_status`.**

Rows paid before **2026-09-05** predate PR #193/#195. Under the older flow the
customer was emailed, but `report_status` and `email_sent_at` were never set. Those
rows therefore look like this:

| column | value | reality |
|--------|-------|---------|
| `payment_status` | `paid` | really paid |
| `sections` | full report | report exists |
| `report_status` | `NULL` | but it IS complete |
| `email_sent_at` | `NULL` | but the customer WAS emailed |

**`email_sent_at IS NULL` does NOT mean undelivered for these rows.** Any recovery
logic that assumes otherwise will re-email real customers. That mistake previously
regenerated July reports through Gemini and emailed them again in September, and
the 20-40s generations blew the 60s function budget (the 504s).

Both the sweep filter and `fulfillPayment` now use:

```js
const hasRealReport = Array.isArray(sections) && sections.length > 5;
```

and `fulfillPayment` additionally settles historical sales: if a row already has a
report and `paid_at` is older than `DELIVERY_MAX_AGE_MS` (7 days), it backfills
`report_status`/`email_sent_at` and returns `legacy_already_served` — no Gemini,
no email.

The whole run is bounded by `RUN_BUDGET_MS` (45s), so it defers instead of dying.

### Reconcile sweep — Meta Purchase freshness rule (BUG-030)

`reconcile-payments` runs `sweepStuckPaidRows()`, which picks up **every** paid
row whose `report_status` is null/failed/generating — including sales from weeks
ago. Each one goes through `fulfillPayment()`, which can fire the server-side
Meta CAPI Purchase.

`maybeSendMetaPurchase()` therefore enforces a **freshness rule** so the sweep
can never report an old sale as a new conversion:

| Situation | Reported to Meta? |
|-----------|-------------------|
| This call just marked the row paid (`justPaid`) | ✅ Yes — genuinely new sale |
| Already paid, `paid_at` within 24h | ✅ Yes — real missed-payment recovery |
| Already paid, `paid_at` older than 24h | ❌ No — stamped "do not report" |
| Already paid, `paid_at` is `NULL` | ❌ No — payment time unknowable |

Rows that fail the check get `meta_purchase_sent_at` stamped so later sweeps
short-circuit immediately. In that case the stamp means *"do not report"*, not
*"successfully sent"*.

**Symptom this prevents:** a Purchase appearing in Meta Ads Manager on a day with
zero ad spend, attributed as "direct", with no matching Razorpay payment.

---

## Manual operational endpoints

| Endpoint | Auth | When to use |
|----------|------|-------------|
| `GET /api/manual-send-emails` | Cron | Push all currently-due nurture emails now. `?force`, `?fresh`, `?email=`, `?budget=<ms>`. |
| `GET /api/backfill-email-drafts` | Cron | Generate drafts for old leads missing them (batch of 3). |
| `GET /api/admin/reconcile-payments?reportId=&paymentId=&count=` | Admin | Recover a specific/one/N missed payment(s). |
| `GET /api/admin/diagnose-report?reportId=|email=` | Admin | Read-only: why a row is/isn't in Overview. |
| `GET /api/admin/export?format=json` | Admin | Full data backup (reports + guidance + blog). |
| `GET /api/admin/logs` | Admin | Persistent ops log (survives Vercel's retention). See below. |

## Persistent ops logs

Vercel Hobby retains runtime logs only briefly and **Log Drains are Pro/Enterprise
only**, so the app writes its own events into Supabase `ops_logs`
(migration `009_ops_logs.sql`).

Read them via `GET /api/admin/logs` with `Authorization: Bearer <ADMIN_SECRET>`:

| Param | Example | Purpose |
|-------|---------|---------|
| `reportId` | `RPT-1788...` | Full timeline for ONE report — best for support |
| `event` | `payment.verified` | Exact event name |
| `prefix` | `meta` | All `meta.*` events |
| `level` | `problems` | `warn` + `error` only (or `info`/`warn`/`error`) |
| `since` | `24h` | `5m`/`3h`/`24h`/`7d`/`30d` (default `7d`) |
| `limit` | `200` | 1-500, default 100 |

### Event catalogue

| Event | Level | Meaning |
|-------|-------|---------|
| `funnel.preview_generated` | info | Someone completed the form and got a preview — **funnel step 1** |
| `funnel.preview_rejected` | warn | Form submitted but validation failed |
| `funnel.preview_rate_limited` | warn | Hit the 3/min preview cap |
| `funnel.preview_failed` | error | Gemini failed — lead lost at step 1 |
| `funnel.order_created` | info | Clicked Pay, Razorpay order exists — **funnel step 2** |
| `funnel.order_rate_limited` | warn | Hit the 5/min order cap |
| `funnel.order_failed` | error | Wanted to pay and we failed them |
| `payment.verified` | info | Signature valid, marked paid — **funnel step 3** |
| `payment.signature_invalid` | warn | Rejected callback |
| `payment.order_fetch_failed` | error | Paid but report unidentifiable |
| `payment.db_update_failed` | error | Paid but DB not updated (customer still saw success) |
| `webhook.processed` | info | Razorpay webhook handled |
| `webhook.not_configured` | error | `RAZORPAY_WEBHOOK_SECRET` missing — safety net OFF |
| `webhook.unresolved` | error | Real payment, no `reportId` resolved |
| `webhook.error` | error | Webhook threw |
| `report.delivered` | info | Customer received their report |
| `report.delivery_failed` | error | Email send failed, claim released |
| `report.delivery_blocked` | warn | Refused — row not paid (BUG-032 guard) |
| `fulfill.legacy_settled` | info | Historical sale settled, not re-sent (BUG-031 guard) |
| `meta.purchase_sent` | info | Meta accepted the server Purchase |
| `meta.purchase_not_sent` | warn | Skipped/failed, with reason |
| `meta.purchase_suppressed_stale` | info | Old sale not reported as new (BUG-030 guard) |
| `cron.reconcile_run` | info | **Daily heartbeat** — counts, timings, budget |
| `cron.nurture_run` | info | **Daily heartbeat** — sent, unique people, dupes retired |
| `cron.*_failed` | error | A cron threw |

### The funnel query

This is the one that answers "why is nobody paying" with data instead of guesses:

```sql
select
  count(*) filter (where event = 'funnel.preview_generated') as previews,
  count(*) filter (where event = 'funnel.order_created')     as clicked_pay,
  count(*) filter (where event = 'payment.verified')         as paid
from ops_logs
where created_at >= (date_trunc('day', now() at time zone 'Asia/Kolkata')
                     at time zone 'Asia/Kolkata');
```

`previews → clicked_pay` is the paywall drop-off. `clicked_pay → paid` is
checkout abandonment. They need opposite fixes, and until now we could not tell
them apart.

### Retention

Handled automatically: the reconcile cron calls `pruneOpsLogs()` daily and deletes
rows older than 90 days. No extra cron needed (Vercel Hobby caps them). Manual
equivalent:

```sql
delete from ops_logs where created_at < now() - interval '90 days';
```

**Rule:** log ops events (payments, deliveries, Meta sends, cron summaries,
errors) — never per-request traffic. The Supabase free tier is 500MB.
| `GET /api/admin/export?format=csv&table=reports\|guidance\|blog` | Admin | Per-table CSV export. |

See [`cli-commands.md`](cli-commands.md) for ready-to-run curl one-liners.

---

## Post-deploy / operational checklist

1. Confirm the Vercel Production deployment is **Ready** (merging ≠ deployed).
2. Ensure cron-job.org is hitting `/api/cron/reconcile-payments` hourly with the
   `Authorization` header (needed on Hobby).
3. Configure `RAZORPAY_WEBHOOK_SECRET` on both Razorpay and Vercel so the webhook
   safety net is active (until then, the reconcile cron covers it).
4. Verify Overview reflects live data (hard-refresh, "All Time").
5. Rotate `ADMIN_SECRET` / `CRON_SECRET` if they were ever shared in plaintext.

*Last updated: September 2026*
