-- Atomic report generation claim.
-- Both /api/generate-full-report (browser) and fulfillPayment (webhook)
-- must call this function. If it returns NULL, another process already
-- owns the generation slot — do NOT call Gemini.

CREATE OR REPLACE FUNCTION claim_report_generation(p_report_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_id TEXT;
BEGIN
  UPDATE reports
     SET report_status = 'generating'
   WHERE report_id = p_report_id
     AND payment_status = 'paid'
     AND report_status NOT IN ('generating', 'completed')
  RETURNING report_id INTO v_id;

  RETURN v_id; -- NULL if 0 rows updated (someone else claimed it)
END;
$$;

-- Same for deep-dive generation (Master tier)
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
     AND deep_dive_status IN ('pending', 'failed')
  RETURNING report_id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_report_generation TO anon;
GRANT EXECUTE ON FUNCTION claim_report_generation TO service_role;
GRANT EXECUTE ON FUNCTION claim_deep_dive_generation TO anon;
GRANT EXECUTE ON FUNCTION claim_deep_dive_generation TO service_role;
