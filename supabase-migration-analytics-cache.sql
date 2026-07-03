-- BhavishAI: Analytics cache table for AI-categorized questions
-- Run in Supabase SQL Editor. Safe to run before or after deploy.
-- If not run, analytics will still work but will call Gemini every time (no caching).
CREATE TABLE IF NOT EXISTS public.analytics_cache (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);
