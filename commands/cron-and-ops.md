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
