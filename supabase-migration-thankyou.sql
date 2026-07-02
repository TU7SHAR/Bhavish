-- BhavishAI: Add thank you email tracking column
-- Run in Supabase SQL Editor. Safe to run before or after deploy.
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS thankyou_sent_at TIMESTAMPTZ;
