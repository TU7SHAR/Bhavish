-- Secure, recoverable report-access tokens.
-- Lets a paid customer open their report via a permanent unguessable link
-- (/report/view/<token>) WITHOUT needing to log in with Google.
--
-- Why: UPI customers who never created an account, or who log in with a
-- different email than the one on the order, currently get locked out of a
-- report they paid for. A per-report random token fixes that.
--
-- Run in the Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS access_token TEXT;

-- Unique so a token maps to exactly one report; indexed for fast lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_access_token
  ON reports (access_token)
  WHERE access_token IS NOT NULL;
