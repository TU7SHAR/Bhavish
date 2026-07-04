-- Store the computed chart data (planets, ascendant, dasha, etc.) with each report
-- so the Kundli charts, planet table, lucky factors, and remedies can be
-- rendered when viewing a saved report (dashboard + founder reports).
-- Run this in Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS chart_data JSONB;
