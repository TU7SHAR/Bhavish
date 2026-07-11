-- Expenses table for BhavishAI Economics tracking.
-- Run this in Supabase → SQL Editor → Run.
--
-- Stores ad spend, tools, services, and any other business expenses
-- so the admin Economics tab can calculate real-time profit/loss.

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,          -- 'ads', 'tools', 'services', 'infra', 'other'
  label text NOT NULL,             -- e.g. "Meta Ads Campaign 1", "Vercel Pro", "Resend"
  amount numeric(10,2) NOT NULL,   -- amount in INR
  date date NOT NULL DEFAULT CURRENT_DATE,  -- date the expense applies to
  notes text,                      -- optional notes
  created_at timestamptz DEFAULT now()
);

-- Index for fast date-range queries (the Economics tab filters by date)
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses (date DESC);

-- RLS: Only service_role can access (admin API uses service_role key)
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- No public access — only the service_role key (used by admin routes) can read/write.
-- This means the anon key cannot touch this table.
CREATE POLICY "Service role full access" ON public.expenses
  FOR ALL USING (true) WITH CHECK (true);
