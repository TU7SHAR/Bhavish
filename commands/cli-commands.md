# CLI Commands

Shell / npm commands used for development, building, and operating BhavishAI.
Source of truth for scripts: `package.json`.

---

## npm scripts (`package.json`)

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the Next.js dev server (`next dev`). Local development only. |
| `npm run build` | Production build (`next build`). Run before deploy to catch build errors. |
| `npm run start` | Serves the production build (`next start`). |
| `npm run lint` | Runs ESLint (`eslint`) using `eslint.config.mjs` (Next.js rules). |

> **Sandbox / CI note:** never run `npm run dev`/`start` as a blocking foreground
> process in automation — they are long-running. Use `npm run build` and
> `npm run lint` for verification.

---

## Common local workflows

```bash
# First-time setup
npm install

# Verify a change compiles + lints (do this before every PR)
npm run build
npm run lint
```

---

## Deployment

- **Hosting:** Vercel (auto-deploy on push to `main`).
- There is **no manual deploy command** — merging to `main` triggers Vercel CI/CD.
- Rollback: use Vercel's dashboard "instant rollback" to a previous deployment.

---

## AI model (used everywhere)

```
gemini-3.1-flash-lite   (15 RPM, 500 RPD on the free tier)
```

- Do **not** switch to `gemini-2.5-flash` — it returned frequent 503s in this project.
- All Gemini calls go through `lib/gemini-retry.js` (exponential backoff on 503).

---

## Database migrations

Migrations are plain SQL, applied manually in the **Supabase SQL Editor**
(Dashboard → SQL Editor → New Query). There is no automated migration runner.

| File | Purpose |
|------|---------|
| `supabase/migrations/001_rate_limits_table.sql` | `rate_limits` table + `check_rate_limit()` / `cleanup_rate_limits()` RPCs |
| `supabase-migration.sql` | Base `reports` / `blog_posts` schema |
| `supabase-migration-founder-free.sql` | Founder-free member columns |
| `supabase-migration-thankyou.sql` | Thank-you email tracking column |
| `supabase-migrations/chart_data.sql` | `chart_data` column for reports |
| `supabase-migrations/visitor_sessions.sql` | Visitor/attribution session tracking |

> Also required (referenced by `generate-full-report`): the
> `claim_report_generation(p_report_id)` RPC for atomic generation claiming.

---

## Operational one-liners (curl)

Replace `$SECRET` with `CRON_SECRET`/`ADMIN_SECRET` and `$BASE` with the site URL.

```bash
# Trigger the nurture-email cron manually
curl -H "Authorization: Bearer $SECRET" "$BASE/api/cron/send-nurture-emails"

# Trigger payment reconciliation (scan recent captured payments)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/cron/reconcile-payments"

# Send all currently-due nurture emails (no time budget; supports ?force, ?fresh, ?email)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/manual-send-emails"

# Diagnose why a report is / isn't counted in Overview (read-only)
curl -H "Authorization: Bearer $SECRET" "$BASE/api/admin/diagnose-report?reportId=RPT-xxx"

# Full JSON backup of all data
curl -H "Authorization: Bearer $SECRET" "$BASE/api/admin/export?format=json" -o backup.json
```

*Last updated: September 2026*
