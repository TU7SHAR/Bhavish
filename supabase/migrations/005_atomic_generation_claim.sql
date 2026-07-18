-- Atomic report generation claim.
-- Both /api/generate-full-report (browser) and fulfillPayment (webhook)
-- must call this function. If it returns NULL, another process already
-- owns the generation slot — do NOT call Gemini.
--
-- FIXES: Uses COALESCE to handle NULL report_status (fresh preview rows).
-- Also includes stale-lock recovery: if a row has been "generating" for >5
-- minutes (function timed out / killed), it can be re-claimed.

CREATE OR REPLACE FUNCTION claim_report_generation(p_report_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id TEXT;
BEGIN
  UPDATE reports
     SET report_status = 'generating',
         generation_started_at = now()
   WHERE report_id = p_report_id
     AND payment_status = 'paid'
     AND (
       COALESCE(report_status, 'pending') NOT IN ('generating', 'completed')
       OR (report_status = 'generating' AND generation_started_at < now() - INTERVAL '5 minutes')
     )
  RETURNING report_id INTO v_id;

  RETURN v_id; -- NULL if 0 rows updated (someone else owns it)
END;
$$;

-- Same for deep-dive generation (Master tier).
-- Requires main report to be completed before deep-dive can start.
CREATE OR REPLACE FUNCTION claim_deep_dive_generation(p_report_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id TEXT;
BEGIN
  UPDATE reports
     SET deep_dive_status = 'generating'
   WHERE report_id = p_report_id
     AND payment_status = 'paid'
     AND plan_tier = 'master'
     AND report_status = 'completed'
     AND COALESCE(deep_dive_status, 'pending') IN ('pending', 'failed')
  RETURNING report_id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_report_generation TO anon;
GRANT EXECUTE ON FUNCTION claim_report_generation TO service_role;
GRANT EXECUTE ON FUNCTION claim_deep_dive_generation TO anon;
GRANT EXECUTE ON FUNCTION claim_deep_dive_generation TO service_role;

-- Add the generation_started_at column for stale-lock recovery
ALTER TABLE reports ADD COLUMN IF NOT EXISTS generation_started_at TIMESTAMPTZ;

-- Add email_sent_at for delivery tracking
ALTER TABLE reports ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
