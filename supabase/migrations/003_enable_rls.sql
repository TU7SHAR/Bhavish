-- Enable Row Level Security (RLS) to protect customer data.
--
-- ⚠️ RUN THIS ONLY AFTER deploying the code that routes all server-side WRITES
-- through the service-role client (save-report, verify-payment, verify-upgrade,
-- founder/generate, link-reports). Those routes bypass RLS via the service role;
-- the browser/anon key can then no longer read or write other people's data.
--
-- Model:
--   reports          — authenticated users may SELECT only their own rows.
--                      All writes happen via the service role (server API routes).
--   blog_posts       — anyone may SELECT published posts (public content).
--   guidance_reports — no public access; served only via service-role API routes.
--   rate_limits      — no public access; managed only via service role.

-- ── reports ─────────────────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read ONLY reports linked to their own user_id.
DROP POLICY IF EXISTS reports_select_own ON reports;
CREATE POLICY reports_select_own ON reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- NOTE: No INSERT/UPDATE/DELETE policies are defined on purpose. Without a
-- permissive policy, anon/authenticated clients cannot write. Only the
-- service_role key (used by server API routes) can, because it bypasses RLS.

-- ── blog_posts ──────────────────────────────────────────────────────────
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blog_posts_public_read ON blog_posts;
CREATE POLICY blog_posts_public_read ON blog_posts
  FOR SELECT
  TO anon, authenticated
  USING (published IS DISTINCT FROM false);

-- ── guidance_reports ────────────────────────────────────────────────────
-- Served only through the /api/guidance-reports route (service role, with an
-- in-code ownership check). No direct public policy.
ALTER TABLE guidance_reports ENABLE ROW LEVEL SECURITY;

-- ── rate_limits ─────────────────────────────────────────────────────────
-- Managed only by the rate limiter via service role. No public policy.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Verify afterwards with:
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('reports','blog_posts','guidance_reports','rate_limits');
-- relrowsecurity should be true for each.
