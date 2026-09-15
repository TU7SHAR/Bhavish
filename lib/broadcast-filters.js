import { createClient } from "@supabase/supabase-js";

/**
 * Shared recipient-filtering for the admin Broadcast feature.
 *
 * ONE source of truth used by both the preview endpoint (count only) and the
 * send endpoint (actually mails), so the "this matches N people" number can
 * never disagree with who actually receives the broadcast.
 *
 * SAFETY RULES baked in here, not left to the caller:
 *  - never include a row with no usable email
 *  - never include anyone who unsubscribed (email_sequence_status = 'unsubscribed')
 *  - de-duplicate by email (a person can have many report rows) so nobody gets
 *    the same broadcast multiple times
 */

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * @param {Object} f  filter object from the admin UI
 * @param {string}  [f.dateFrom]   ISO date (inclusive) — matched against created_at, or paid_at for paid filter
 * @param {string}  [f.dateTo]     ISO date (inclusive)
 * @param {string}  [f.status]     'all' | 'paid' | 'unpaid' | 'founder'
 * @param {string}  [f.tier]       'any' | 'essential' | 'premium' | 'master'
 * @param {string}  [f.gender]     'any' | 'male' | 'female' | 'other'
 * @param {string}  [f.guidance]   'any' | 'yes' | 'no'
 * @returns {Promise<{recipients: Array<{email, name}>, total: number, error?: string}>}
 */
export async function selectRecipients(f = {}) {
  const supabase = getSupabase();

  // Pull the minimum columns needed to filter + personalise. Paginate so we are
  // not silently capped at Supabase's default 1000-row ceiling.
  const cols =
    "report_id, name, email, gender, payment_status, plan_tier, has_12_month_guidance, is_founder_member, email_sequence_status, created_at, paid_at";

  const rows = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("reports")
      .select(cols)
      .not("email", "is", null)
      .neq("email", "")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { recipients: [], total: 0, error: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }

  const status = f.status || "all";
  const tier = f.tier || "any";
  const gender = f.gender || "any";
  const guidance = f.guidance || "any";
  const fromMs = f.dateFrom ? Date.parse(f.dateFrom) : null;
  // dateTo is inclusive of the whole day → add 24h.
  const toMs = f.dateTo ? Date.parse(f.dateTo) + 24 * 3600 * 1000 : null;

  const matched = rows.filter((r) => {
    // HARD SAFETY: never mail an unsubscribed person.
    if ((r.email_sequence_status || "").toLowerCase() === "unsubscribed") return false;

    const isPaid = r.payment_status === "paid";

    if (status === "paid" && !isPaid) return false;
    if (status === "unpaid" && r.payment_status !== "unpaid") return false;
    if (status === "founder" && !r.is_founder_member) return false;

    if (tier !== "any" && (r.plan_tier || "") !== tier) return false;

    if (gender !== "any" && (r.gender || "").toLowerCase() !== gender) return false;

    if (guidance === "yes" && r.has_12_month_guidance !== true) return false;
    if (guidance === "no" && r.has_12_month_guidance === true) return false;

    // Date range: use paid_at for paid-status filter, else created_at.
    const refTs = status === "paid" ? r.paid_at || r.created_at : r.created_at;
    if (fromMs || toMs) {
      const t = refTs ? Date.parse(refTs) : NaN;
      if (!Number.isFinite(t)) return false;
      if (fromMs && t < fromMs) return false;
      if (toMs && t >= toMs) return false;
    }

    return true;
  });

  // De-duplicate by normalised email, keeping the first (most recent) name.
  const byEmail = new Map();
  for (const r of matched) {
    const key = r.email.trim().toLowerCase();
    if (!byEmail.has(key)) {
      byEmail.set(key, { email: r.email.trim(), name: r.name || "" });
    }
  }

  const recipients = [...byEmail.values()];
  return { recipients, total: recipients.length };
}
