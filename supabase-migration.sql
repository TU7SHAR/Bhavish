-- ============================================
-- BhavishAI: Add richer lead tracking columns
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================

-- When the preview was generated (different from created_at which is DB insert time)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS preview_generated_at TIMESTAMPTZ;

-- When payment was actually verified (exact conversion timestamp)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Device type: 'mobile' or 'desktop' (critical for Indian audience analytics)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS device_type TEXT;

-- The user's personal question/concern (shows intent — high-value data)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS personal_question TEXT;

-- Normalized city extracted from geocoding result (for geo analytics)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS city TEXT;

-- ============================================
-- VERIFICATION: Run this to confirm columns were added
-- ============================================
-- SELECT column_name, data_type FROM information_schema.columns 
-- WHERE table_name = 'reports' AND column_name IN ('preview_generated_at', 'paid_at', 'device_type', 'personal_question', 'city');
