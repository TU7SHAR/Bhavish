-- Rate limiting table for persistent, cross-instance rate limit enforcement.
-- Run this in the Supabase SQL Editor (or via supabase db push if using CLI).

-- Table to store rate limit counters
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for cleanup queries (find expired windows)
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits (window_start);

-- Atomic rate limit check function.
-- Increments the counter within the window, or resets if the window has expired.
-- Returns whether the request is allowed and the current count.
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_key TEXT,
  p_max_requests INTEGER,
  p_window_ms BIGINT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_record rate_limits%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ := v_now - (p_window_ms || ' milliseconds')::INTERVAL;
  v_allowed BOOLEAN;
  v_count INTEGER;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_record FROM rate_limits WHERE key = p_key FOR UPDATE;

  IF v_record IS NULL THEN
    -- First request for this key — insert new record
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (p_key, 1, v_now)
    ON CONFLICT (key) DO UPDATE SET count = 1, window_start = v_now;
    RETURN json_build_object('allowed', true, 'current_count', 1);
  END IF;

  IF v_record.window_start < v_window_start THEN
    -- Window expired — reset
    UPDATE rate_limits SET count = 1, window_start = v_now WHERE key = p_key;
    RETURN json_build_object('allowed', true, 'current_count', 1);
  END IF;

  -- Within window — increment
  v_count := v_record.count + 1;
  UPDATE rate_limits SET count = v_count WHERE key = p_key;

  v_allowed := v_count <= p_max_requests;
  RETURN json_build_object('allowed', v_allowed, 'current_count', v_count);
END;
$$;

-- Cleanup function: removes expired records older than 2 hours.
-- Call this from a cron job or periodically. The table stays small
-- regardless (~a few hundred rows at peak traffic).
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '2 hours';
END;
$$;

-- Grant access to the anon and service_role roles
GRANT ALL ON rate_limits TO anon;
GRANT ALL ON rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION check_rate_limit TO anon;
GRANT EXECUTE ON FUNCTION check_rate_limit TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_rate_limits TO service_role;
