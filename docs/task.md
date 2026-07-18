# Current Task

## Session Goals — July 2026

> **Delete or clear this file after tasks are completed.** It keeps the working memory clean and focused on immediate work.

---

## Active Tasks

### Task 1: Run Rate Limit Migration
**Priority:** P0 (rate limiting won't persist until this is done)
**Status:** Pending (requires Supabase SQL Editor access)

**Steps:**
1. Open Supabase Dashboard → SQL Editor
2. Copy SQL from `supabase/migrations/001_rate_limits_table.sql`
3. Run it
4. Verify: `SELECT * FROM rate_limits;` should return empty table
5. Verify: `SELECT check_rate_limit('test:127.0.0.1', 5, 60000);` should return `{"allowed": true, "current_count": 1}`

---

### Task 2: Verify IST Fix Doesn't Break Existing Indian Users
**Priority:** P0 (most users are Indian — must not regress)
**Status:** Pending

**Steps:**
1. Test with Mumbai coordinates (19.076, 72.877) → should get `timezoneOffsetMinutes: 330`
2. Test with New York coordinates (40.7, -74.0) → should get `null` (uses LMT)
3. Compare planetary positions for a known chart (e.g., 1990-01-15 10:30 Mumbai)
4. Verify ascendant hasn't shifted from the previous calculation

---

### Task 3: Store PDF URL in DB for Re-download
**Priority:** P1 (nice-to-have for dashboard report view)
**Status:** Not started

**What:**
- After `generate-pdf` succeeds during email send, store the base64 or a reference
- Dashboard report view can offer "Download PDF" without regenerating
- Consider: store in Supabase Storage (bucket) vs. inline in DB (JSONB is large)

---

## Recently Completed

- [x] Created project documentation suite (PRD, architecture, requirements, implementation plan, audit, bugs, testing)
- [x] Fixed IST hardcoding in vedic-calculator.js
- [x] Added server-side PDF download (client fallback)
- [x] Replaced in-memory rate limiter with Supabase-backed persistence
- [x] Updated PROJECT.md with migration SQL

---

## Blocked / Waiting

| Item | Blocked On | Who |
|------|-----------|-----|
| Rate limit migration | Supabase dashboard access | Owner |
| Bounce handling | Resend webhook setup | Owner (Resend dashboard) |
| Error monitoring | Sentry account creation | Owner |

---

## Notes for Next Session

- The `fix/ist-pdf-ratelimit` PR (#148) needs to be merged before any of these tasks matter
- After merge, test the preview generation flow end-to-end on production
- Check Vercel logs for any `[rate-limit] Supabase error` messages (indicates migration not run yet)
- The rate limiter gracefully falls back to local-only if migration hasn't been run

---

*This file is ephemeral. Clear it after completing the above tasks and replace with the next set from `implementation_plan.md`.*
