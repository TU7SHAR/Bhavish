import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for server-side writes and privileged reads.
 *
 * The service role BYPASSES Row Level Security (RLS). Use this in API routes
 * for operations that must succeed regardless of the caller's auth state —
 * e.g. saving a guest lead, marking a payment paid, generating reports.
 *
 * NEVER import this into client-side code. It must only run on the server.
 *
 * Falls back to the anon key if the service role isn't configured (keeps
 * local/dev working), but in production SUPABASE_SERVICE_ROLE_KEY must be set
 * for these writes to work once RLS is enabled.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
