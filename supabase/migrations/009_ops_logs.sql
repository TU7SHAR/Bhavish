-- Persistent operational log.
--
-- WHY THIS EXISTS:
-- Vercel's Hobby plan keeps runtime logs for a very short window, and Log Drains
-- (the supported way to ship logs somewhere permanent) are a Pro/Enterprise
-- feature. That meant every production incident had to be diagnosed from
-- whatever happened to still be on screen — and several bugs (BUG-026 owner
-- emails, BUG-030 Meta purchases, BUG-031 duplicate report emails) were only
-- caught because a screenshot happened to be taken in time.
--
-- This table is the free, self-hosted alternative: the app writes its own
-- structured events straight into Postgres, so they persist as long as we want
-- and can be JOINed against `reports` (e.g. every event for one report_id).
--
-- IMPORTANT: this is for MEANINGFUL OPS EVENTS ONLY — payments, deliveries,
-- Meta events, cron summaries and errors. Do NOT log every HTTP request; the
-- Supabase free tier is 500MB and per-request logging would burn it.
--
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS ops_logs (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'info' | 'warn' | 'error'
  level       TEXT NOT NULL DEFAULT 'info',
  -- stable machine-readable name, e.g. 'payment.verified', 'report.delivered'
  event       TEXT NOT NULL,
  -- which report this concerns (nullable: cron summaries aren't per-report)
  report_id   TEXT,
  -- which code path emitted it, e.g. 'verify-payment', 'cron-reconcile'
  source      TEXT,
  -- short human-readable line
  message     TEXT,
  -- structured payload; never put secrets or full report content in here
  meta        JSONB
);

-- Query patterns: newest-first browsing, per-report timelines, filtering by
-- event name, and "show me only the failures".
CREATE INDEX IF NOT EXISTS ops_logs_created_at_idx ON ops_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS ops_logs_report_id_idx  ON ops_logs (report_id);
CREATE INDEX IF NOT EXISTS ops_logs_event_idx      ON ops_logs (event);
CREATE INDEX IF NOT EXISTS ops_logs_problems_idx   ON ops_logs (created_at DESC)
  WHERE level IN ('warn', 'error');

-- Service-role only. RLS on with NO policy means anon/authenticated clients get
-- nothing; the service role bypasses RLS, so server code still writes fine.
ALTER TABLE ops_logs ENABLE ROW LEVEL SECURITY;

-- ── RETENTION ─────────────────────────────────────────────────────────────
-- Volume is tiny (a handful of rows per payment), so 90 days is comfortable.
-- Run this occasionally, or wire it into a cron later:
--
--   DELETE FROM ops_logs WHERE created_at < now() - INTERVAL '90 days';
