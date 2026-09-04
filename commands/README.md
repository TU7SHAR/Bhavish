# Commands & File Reference

> **Living reference.** This folder documents *what each command, API route, and
> library module does* in BhavishAI. It complements the narrative docs in `/docs`
> and the high-level `PROJECT.md`.
>
> **Maintenance rule:** whenever a command, API route, or `lib/` module is added,
> removed, or materially changed, update the matching file here in the *same
> change/PR*. See [`docs/DOCS_MAINTENANCE.md`](../docs/DOCS_MAINTENANCE.md).

---

## Contents

| File | Covers |
|------|--------|
| [cli-commands.md](cli-commands.md) | Shell/npm commands for dev, build, lint, deploy, and operational one-liners |
| [api-routes.md](api-routes.md) | Every `app/api/**/route.js` endpoint — method, auth, purpose |
| [lib-modules.md](lib-modules.md) | Every `lib/*.js` module — exports and responsibility |
| [pages.md](pages.md) | Every user-facing/admin `page.js` route |
| [cron-and-ops.md](cron-and-ops.md) | Scheduled jobs, manual ops endpoints, and how to trigger them safely |

---

## How to read this

- **Auth column legend** (see `lib/auth.js`):
  - `None` — public (protected by rate limiting + input validation)
  - `Internal` — server-to-server only (`verifyInternal()`)
  - `Cron` — scheduler/external trigger (`verifyCron()`, `CRON_SECRET`)
  - `Admin` — human operator (`verifyAdmin()`, `ADMIN_SECRET` → `CRON_SECRET` fallback)
  - `User` — Supabase Auth (Google OAuth) session
  - `Payment-gated` — requires `payment_status='paid'` in DB for that report

- The **single source of truth is always the code**. If this reference and the
  code disagree, the code wins — and this file should be corrected.

*Last updated: September 2026*
