-- Visitor Journey Tracking
-- Run this in Supabase SQL Editor

-- Table to store every meaningful page view
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,          -- anonymous UUID from localStorage
  session_id TEXT NOT NULL,          -- unique per browser session (sessionStorage)
  page TEXT NOT NULL,                -- e.g. '/', '/get-report', '/report/preview', '/report/full'
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_type TEXT,                  -- 'mobile' or 'desktop'
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT
);

-- Index for fast lookups by visitor
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_sessions_timestamp ON visitor_sessions(timestamp);

-- Add visitor_id column to reports table to link anonymous visitors to leads
ALTER TABLE reports ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reports_visitor_id ON reports(visitor_id);
