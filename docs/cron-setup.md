# Cron Setup — cron-job.org

**Last Updated:** August 2026
**Purpose:** Trigger BhavishAI's scheduled endpoints reliably using the free
[cron-job.org](https://cron-job.org) service.

---

## Why an external cron service?

Vercel's built-in cron (`vercel.json`) is configured, but on the **Hobby (free)
tier each cron job only fires ONCE PER DAY**. That's fine for the twice-daily
nurture emails (they're two separate daily jobs), but the
`/api/cron/reconcile-payments` job is meant to run **hourly** so missed UPI
payments self-heal quickly. On the free tier that hourly schedule won't fire
hourly.

**cron-job.org** solves this: it's free, needs no credit card, supports
schedules down to **every minute**, and — critically — lets you set a custom
`Authorization` header, which our endpoints require.

> If/when the project is on **Vercel Pro**, the `vercel.json` crons fire on
> their real schedules and this external service becomes optional. Until then,
> cron-job.org is the recommended trigger.

---

## Endpoints to trigger

All cron endpoints are `GET` and authenticate with a Bearer token:

```
Authorization: Bearer <CRON_SECRET>
```

`<CRON_SECRET>` is the same value set in your Vercel environment variables.
**Never commit the real secret to the repo — paste it only into cron-job.org.**

| Endpoint | Recommended schedule | What it does |
|----------|---------------------|--------------|
| `https://www.bhavishai.in/api/cron/reconcile-payments` | Every 1 hour | Scans recent captured Razorpay payments and fulfils any that were missed (browser callback didn't fire / webhook missed). Idempotent — safe to run repeatedly. |
| `https://www.bhavishai.in/api/cron/send-nurture-emails` | 9:00 AM IST & 9:00 PM IST | Sends the next due nurture email to unpaid leads (reads pre-generated drafts). Has a 9s time budget; leftovers roll to the next run. |

> **Note on nurture-email times:** `vercel.json` already schedules these at
> `03:00` and `15:30` **UTC** (= 08:30 & 21:00 IST). If you rely on Vercel for
> the nurture emails and only use cron-job.org for reconciliation, you don't
> need to add the nurture job here — just add the reconcile job. Adding both is
> harmless (the sends are idempotent and cooldown-guarded), but avoid stacking
> the same job at the exact same minute from two services.

---

## Step-by-step: cron-job.org

1. **Create a free account** at https://cron-job.org and sign in.

2. **Create a cronjob** (dashboard → "Create cronjob").

3. **Reconciliation job:**
   - **Title:** `BhavishAI — Reconcile Payments`
   - **URL:** `https://www.bhavishai.in/api/cron/reconcile-payments`
   - **Schedule:** Every hour (e.g. "Every 1 hour(s)", at minute `0`).
   - **Request method:** `GET`
   - Expand **Advanced → Headers** and add:
     - **Key:** `Authorization`
     - **Value:** `Bearer <CRON_SECRET>`  ← paste your real secret here
   - (Optional) Set an execution timeout of ~60s to match the endpoint's `maxDuration`.
   - **Save**.

4. **(Optional) Nurture-email job** — only if you want cron-job.org to drive it
   instead of Vercel:
   - **Title:** `BhavishAI — Nurture Emails (AM)`
   - **URL:** `https://www.bhavishai.in/api/cron/send-nurture-emails`
   - **Schedule:** daily at your chosen IST time. cron-job.org schedules in the
     timezone you pick in account settings — set it to **Asia/Kolkata** so the
     times below are IST directly. If left as UTC, convert (IST = UTC + 5:30).
   - Add the same `Authorization: Bearer <CRON_SECRET>` header.
   - **Save**. Duplicate for a second daily run (e.g. an evening send) if desired.

---

## Verifying it works

- In cron-job.org, open the job → **History** tab. A successful run shows
  **HTTP 200**.
- A `200` from `reconcile-payments` returns JSON like:
  ```json
  { "ok": true, "summary": { "scanned": 30, "captured": 12, "fulfilled": 0, "alreadyDone": 12, "failed": 0 } }
  ```
  `fulfilled > 0` means it actually recovered a missed payment.
- **HTTP 401** = wrong/missing `Authorization` header (check the Bearer value
  matches `CRON_SECRET` in Vercel).
- **HTTP 500 "no cron secret configured"** = `CRON_SECRET` isn't set in the
  Vercel environment.

---

## Security notes

- The secret lives ONLY in Vercel env vars and the cron-job.org header — never
  in the repository.
- If the secret is ever exposed, rotate it: update `CRON_SECRET` (and/or
  `ADMIN_SECRET`) in Vercel, redeploy, then update the header value in
  cron-job.org.
- Endpoints are idempotent, so an occasional duplicate trigger causes no harm.
