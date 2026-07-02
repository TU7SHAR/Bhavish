-- ============================================
-- BhavishAI: Add richer lead tracking columns
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- Safe to run anytime — before or after deploying the code update.
-- ============================================

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS preview_generated_at TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS device_type TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS personal_question TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS city TEXT;
