# Current Task

## Session Goals — August 2026

> **Delete or clear this file after tasks are completed.**

---

## Recently Completed (August 2026)

- [x] PR #176: Auto-reconciliation cron (`/api/cron/reconcile-payments`) — self-heals missed UPI payments hourly. Idempotent.
- [x] PR #177: Bulk monthly-guidance generation (free-tier-safe, one Gemini call at a time) + super admin data export (`/api/admin/export`, JSON + CSV).
- [x] PR #178: `docs/cron-setup.md` — cron-job.org setup guide (external trigger for sub-hourly / header-authed crons).
- [x] PR #179: "Diagnose Missing Payment" admin tool (`/api/admin/diagnose-report`, read-only).
- [x] PR #180: Overview 1000-row Supabase cap fix (paginated fetch + lightweight columns). Fixes under-counted revenue and slow load.
- [x] PR #181: Overview stale-cache fix (`force-dynamic` + client `no-store`). Fixes recent paid customer not appearing.

---

## After Merging / Deploying

1. **Deploy to Vercel** and confirm the Production deployment is **Ready** (merging ≠ deployed).
2. **Set up cron-job.org** to hit `/api/cron/reconcile-payments` hourly with `Authorization: Bearer <CRON_SECRET>` (see `docs/cron-setup.md`). Needed because Vercel Hobby crons run only once/day.
3. **Verify Overview**: hard-refresh, select "All Time", confirm recent paid customers appear. Use **Actions → Diagnose Missing Payment** if any row is still questioned.
4. **Recover the specific stuck payment** if not already fulfilled: `/api/admin/reconcile-payments?reportId=RPT-...&paymentId=pay_...&planId=premium`.
5. **Rotate `ADMIN_SECRET`/`CRON_SECRET`** (was shared in plaintext during debugging).

---

## Open Follow-ups (Future Sessions)

- [ ] **BUG-022:** Apply the same 1000-row pagination + `force-dynamic` fix to `/api/admin/analytics` (same class of bug as Overview).
- [ ] Configure `RAZORPAY_WEBHOOK_SECRET` in Razorpay + Vercel so the webhook safety net works alongside the reconcile cron.
- [ ] Google Search Console: resolve "Blocked due to other 4xx" for `links.bhavishai.in` (cosmetic; likely the link-tracking subdomain — add robots rule / redirect).
- [ ] Kundli SVG chart rendering in the PDF generator
- [ ] Store generated PDFs in Supabase Storage for re-download
- [ ] Resend bounce/complaint webhook handling
- [ ] Sentry error monitoring integration
- [ ] Uptime monitoring (external ping)

---

*This file is ephemeral. Clear after completing above and replace with next goals.*
