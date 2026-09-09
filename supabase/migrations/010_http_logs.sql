-- Per-request HTTP log (the "Vercel logs" view, self-hosted).
--
-- WHY A SEPARATE TABLE FROM ops_logs:
--   ops_logs holds a small number of SEMANTIC events (a payment happened, a
--   report was delivered). This table holds one row per HTTP request, so it is
--   1-2 orders of magnitude higher volume and wants shorter retention. Mixing
--   them would drown the meaningful events.
--
-- VOLUME: static assets are excluded by the proxy matcher, so this is real page
--   and API hits only. At ~70 visitors/day that is a few thousand rows/day —
--   comfortable on the Supabase free tier with 30-day retention.
--
-- IMPORTANT — why `status` is often NULL:
--   Next.js proxy/middleware runs BEFORE the response is produced, so it cannot
--   observe the eventual status code. Status is therefore only populated where we
--   genuinely know it:
--     - proxy CSRF rejections  → 403
--     - the not-found page      → 404
--     - route handlers that opt into withHttpLog()
--   Everything else records the request with status NULL. Getting a status on
--   literally every request requires the edge/CDN layer itself, which is exactly
--   what Vercel's paid log retention provides.
--
-- Run in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS http_logs (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  method      TEXT NOT NULL,
  path        TEXT NOT NULL,
  -- NULL when unknowable at proxy time (see note above)
  status      INT,
  duration_ms INT,
  -- 'proxy' | 'not-found' | 'route'
  source      TEXT NOT NULL DEFAULT 'proxy',
  -- coarse client info; full UA kept for bot/device debugging
  device      TEXT,
  user_agent  TEXT,
  referrer    TEXT,
  country     TEXT,
  meta        JSONB
);

CREATE INDEX IF NOT EXISTS http_logs_created_at_idx ON http_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS http_logs_path_idx       ON http_logs (path);
CREATE INDEX IF NOT EXISTS http_logs_status_idx     ON http_logs (status) WHERE status IS NOT NULL;
-- Fast "show me the errors" scan
CREATE INDEX IF NOT EXISTS http_logs_errors_idx     ON http_logs (created_at DESC)
  WHERE status >= 400;

-- Service-role only (RLS on, no policy).
ALTER TABLE http_logs ENABLE ROW LEVEL SECURITY;

-- ── RETENTION ─────────────────────────────────────────────────────────────
-- Run this periodically (or once a month by hand). Automatic pruning is wired
-- into the reconcile cron in a follow-up, once PR #217 lands — that PR already
-- edits the cron file and doing it here would create a merge conflict.
--
--   DELETE FROM http_logs WHERE created_at < now() - INTERVAL '30 days';
--
-- Rough sizing at ~70 visitors/day: a few thousand rows/day, well inside the
-- Supabase free tier at 30-day retention.
