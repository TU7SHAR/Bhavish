# Current Task

## Session Goals — July 2026

> **Delete or clear this file after tasks are completed.**

---

## Recently Completed

- [x] PR #150: Three-tier pricing (Essential/Premium/Master) — merged
- [x] PR #151: Bug fixes (email undefined, footer overlay, deep-dive styling)
- [x] PR #152: Admin panel tier refactor (revenue calc, tier badges, gift upgrades)
- [x] PR #153: P0 payment & fulfillment hardening (security critical)
- [x] PR #154: Admin gift upgrade buttons + howto email update + docs

---

## Pending Merges (in order)

1. **PR #153** — merge FIRST (security critical, fixes paywall bypass)
2. **PR #151** — bug fixes (independent)
3. **PR #152** — admin panel (depends on plan_tier columns)
4. **PR #154** — admin gift buttons + howto (depends on #152's gift API types)

---

## After Merging All PRs

1. Run migration 002 + 004 in Supabase SQL Editor (if not already done)
2. Deploy to Vercel
3. Run migration 003 (RLS) — ONLY after deploy
4. Test one complete real payment flow end-to-end
5. Verify admin panel shows tier badges + gift buttons work
6. Update live ad creatives (remove any "20-page ₹299" copy)

---

## Open Follow-ups (Future Sessions)

- [ ] Kundli SVG chart rendering in the PDF generator
- [ ] Store generated PDFs in Supabase Storage for re-download
- [ ] Resend bounce/complaint webhook handling
- [ ] Sentry error monitoring integration
- [ ] Uptime monitoring (external ping)
- [ ] Make preview save synchronous (await before enabling payment)
- [ ] A/B test tier selection defaults

---

*This file is ephemeral. Clear after completing above and replace with next goals.*
