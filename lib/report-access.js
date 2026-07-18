import crypto from "crypto";

/**
 * Secure report-access token utilities.
 *
 * A paid customer can open their report via a permanent, unguessable link:
 *   https://www.bhavishai.in/report/view/<access_token>
 *
 * This does NOT require Google login — it solves the common support problem
 * where a customer paid (often via UPI) but can't find their report because
 * they never made an account or signed in with a different email.
 *
 * The token is a 48-char hex string (24 random bytes = 192 bits of entropy),
 * far too large to guess or brute-force.
 */

/** Generate a fresh, cryptographically-random access token. */
export function generateAccessToken() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * Ensures a report row has an access_token, creating one if missing.
 * Idempotent: returns the existing token if already set.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - service-role client
 * @param {string} reportId
 * @returns {Promise<string|null>} the token, or null if the column doesn't exist / lookup failed
 */
export async function ensureAccessToken(supabase, reportId) {
  if (!supabase || !reportId) return null;
  try {
    const { data: report, error } = await supabase
      .from("reports")
      .select("access_token")
      .eq("report_id", reportId)
      .single();

    if (error) return null;
    if (report?.access_token) return report.access_token;

    const token = generateAccessToken();
    const { error: updErr } = await supabase
      .from("reports")
      .update({ access_token: token })
      .eq("report_id", reportId);

    // Column may not exist yet (migration not run) — fail gracefully.
    if (updErr) return null;
    return token;
  } catch {
    return null;
  }
}

/** Build the public report-view URL from a token. */
export function reportViewUrl(token) {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://www.bhavishai.in";
  return `${base}/report/view/${token}`;
}
