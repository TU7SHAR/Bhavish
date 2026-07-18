-- Three-tier plan model (Essential / Premium / Master).
-- Adds plan metadata to the reports table and labels existing customers.
-- Legacy flags (has_12_month_guidance, is_founder_member) are kept for
-- backward compatibility and continue to work.
--
-- Run in the Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS plan_tier TEXT;         -- essential | premium | master | premium_legacy | legacy_founder
ALTER TABLE reports ADD COLUMN IF NOT EXISTS plan_price INTEGER;     -- amount paid in INR (299/448/499/999)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS guidance_months INTEGER; -- 0 or 12
ALTER TABLE reports ADD COLUMN IF NOT EXISTS deep_dive_focus TEXT;   -- career | marriage | wealth | relationship | health | general (Master only)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS deep_dive_status TEXT;  -- none | pending | generating | completed | failed (Master only)

-- ── Label existing customers (no regeneration; access unchanged) ──────────

-- Existing Founder members / free founder reports.
UPDATE reports
   SET plan_tier = 'legacy_founder'
 WHERE plan_tier IS NULL
   AND (is_founder_member = true OR payment_status = 'founder' OR is_founder_free = true);

-- Existing paid customers received the full 20-section report → label as
-- premium_legacy and carry over their guidance flag.
UPDATE reports
   SET plan_tier = 'premium_legacy',
       guidance_months = CASE WHEN has_12_month_guidance = true THEN 12 ELSE 0 END,
       deep_dive_status = 'none'
 WHERE plan_tier IS NULL
   AND payment_status = 'paid';
