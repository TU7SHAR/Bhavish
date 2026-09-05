import crypto from "crypto";

/**
 * Meta (Facebook) Conversions API — server-side event sending.
 *
 * WHY THIS EXISTS:
 * The browser Pixel `Purchase` event (in report/preview/page.js) only fires if
 * the customer's browser completes the Razorpay callback. For a UPI-first
 * Indian audience, a large share of real purchases never reach Meta (tab
 * closed, UPI app redirect, iOS/ad-blockers) — so Meta marks Purchase
 * "inactive" and can't optimise for it. This sends Purchase SERVER-SIDE from
 * fulfillPayment(), where we KNOW the payment is real (incl. webhook +
 * reconciled UPI payments).
 *
 * DEDUPLICATION:
 * Both the browser Pixel and this server event use the SAME `event_id`
 * (`purchase_<reportId>`). Meta automatically de-duplicates events that share
 * an event_id + event_name, so a purchase counted by the browser is NOT
 * double-counted when the server also reports it — and vice-versa.
 *
 * CONFIG (env):
 *   NEXT_PUBLIC_META_PIXEL_ID   — the Pixel/Dataset ID (already used client-side)
 *   META_CAPI_ACCESS_TOKEN      — Conversions API token (Events Manager →
 *                                 Settings → Conversions API → Generate token)
 *   META_TEST_EVENT_CODE        — (optional) shows events in the "Test events"
 *                                 tab while verifying; remove in production.
 *
 * FAIL-SOFT: never throws into the payment flow. Returns a small status object.
 */

const GRAPH_VERSION = "v21.0";

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

// Meta requires PII to be normalised (trim + lowercase) then SHA-256 hashed.
function hashEmail(email) {
  if (!email || typeof email !== "string") return null;
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;
  return sha256(normalised);
}

/**
 * Send a server-side Purchase event to the Meta Conversions API.
 *
 * @param {Object} p
 * @param {string} p.reportId   - used to build the dedup event_id
 * @param {number} p.value      - purchase amount (INR)
 * @param {string} [p.currency] - default "INR"
 * @param {string} [p.email]    - customer email (hashed before sending)
 * @param {string} [p.planTier] - essential | premium | master (content_name)
 * @param {string} [p.eventSourceUrl]
 * @returns {Promise<{sent:boolean, skipped?:string, error?:string}>}
 */
export async function sendPurchaseEvent({ reportId, value, currency = "INR", email, planTier, eventSourceUrl } = {}) {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;

  // Not configured → skip silently (fail-open; never block fulfilment).
  if (!pixelId || !accessToken || pixelId === "your_meta_pixel_id_here") {
    return { sent: false, skipped: "not_configured" };
  }
  if (!reportId) return { sent: false, skipped: "missing_reportId" };

  const userData = {};
  const hashedEmail = hashEmail(email);
  if (hashedEmail) userData.em = [hashedEmail];

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        // SAME id the browser Pixel uses → Meta de-duplicates.
        event_id: `purchase_${reportId}`,
        action_source: "website",
        ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
        user_data: userData,
        custom_data: {
          currency,
          value: Number(value) || 0,
          ...(planTier ? { content_name: planTier, content_type: "product" } : {}),
          content_ids: [reportId],
        },
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };

  try {
    const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[meta-capi] Purchase send failed:", res.status, text.slice(0, 300));
      return { sent: false, error: `http_${res.status}` };
    }
    return { sent: true };
  } catch (e) {
    console.error("[meta-capi] Purchase send exception:", e.message);
    return { sent: false, error: e.message };
  }
}
