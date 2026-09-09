import { createClient } from "@supabase/supabase-js";

/**
 * Persistent operational logging → Supabase `ops_logs`.
 *
 * WHY: Vercel Hobby retains runtime logs only briefly, and Log Drains (the
 * supported way to ship them off-platform) require Pro. So we write our own
 * structured events into Postgres, where they persist and can be JOINed against
 * `reports`.
 *
 * DESIGN RULES:
 *  1. NEVER throw. A logging failure must not break a payment or a delivery.
 *  2. NEVER block meaningfully. One small INSERT (~30-50ms).
 *  3. Log OPS EVENTS, not traffic. Payments, deliveries, Meta sends, cron
 *     summaries, errors. Per-request logging would burn the 500MB free tier.
 *  4. NO secrets and NO full report content in `meta`. IDs, statuses, counts,
 *     durations and short reasons only.
 *
 * If migration 009 hasn't been run, every call quietly no-ops.
 *
 * USAGE:
 *   import { logEvent, logError } from "../lib/ops-log.js";
 *   await logEvent({ event: "payment.verified", reportId, source: "verify-payment",
 *                    message: "signature ok", meta: { tier, amount } });
 */

let cached = null;

function db() {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  cached = createClient(url, key);
  return cached;
}

// Keep a single row small and safe: strip anything huge or obviously sensitive.
const SENSITIVE_KEYS = /token|secret|password|authorization|apikey|api_key|signature/i;
const MAX_META_CHARS = 4000;

function sanitiseMeta(meta) {
  if (!meta || typeof meta !== "object") return null;
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.test(k)) continue; // never persist credentials
    if (v === undefined) continue;
    if (v === null || ["string", "number", "boolean"].includes(typeof v)) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      out[k] = `array(${v.length})`; // summarise, don't dump
    } else {
      out[k] = "[object]";
    }
  }
  const asText = JSON.stringify(out);
  if (asText && asText.length > MAX_META_CHARS) {
    return { truncated: true, note: `meta too large (${asText.length} chars)` };
  }
  return out;
}

/**
 * Write one operational event. Fail-soft: returns false instead of throwing.
 *
 * @param {Object} p
 * @param {string} p.event                     - stable name, e.g. "report.delivered"
 * @param {'info'|'warn'|'error'} [p.level]
 * @param {string} [p.reportId]
 * @param {string} [p.source]                  - emitting code path
 * @param {string} [p.message]
 * @param {Object} [p.meta]                    - small structured payload
 * @returns {Promise<boolean>} true if persisted
 */
export async function logEvent({ event, level = "info", reportId, source, message, meta } = {}) {
  if (!event) return false;

  // Always mirror to the platform log too, so `vercel logs` still shows it live.
  const line = `[${level}] ${event}${reportId ? ` ${reportId}` : ""}${message ? ` — ${message}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  try {
    const supabase = db();
    if (!supabase) return false;

    const { error } = await supabase.from("ops_logs").insert({
      level,
      event,
      report_id: reportId || null,
      source: source || null,
      message: message ? String(message).slice(0, 1000) : null,
      meta: sanitiseMeta(meta),
    });

    // Table missing (migration 009 not run) or any DB issue → stay silent.
    // console.warn here would be noisy on every single call.
    return !error;
  } catch {
    return false;
  }
}

/** Convenience wrapper for warnings. */
export function logWarn(p) {
  return logEvent({ ...p, level: "warn" });
}

/**
 * Convenience wrapper for errors. Accepts an Error or a string; only the
 * message is persisted (stack traces are large and often contain paths).
 */
export function logError(p) {
  const err = p?.error;
  const detail = err instanceof Error ? err.message : err ? String(err) : undefined;
  const { error: _drop, ...rest } = p || {};
  return logEvent({
    ...rest,
    level: "error",
    meta: { ...(rest.meta || {}), ...(detail ? { error: detail.slice(0, 500) } : {}) },
  });
}
