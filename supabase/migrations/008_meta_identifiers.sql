-- Meta browser identifiers for Conversions API deduplication.
--
-- WHY: reliable browser↔server Purchase dedup needs the server-side CAPI event
-- to carry the SAME fbp/fbc (the _fbp/_fbc browser cookies) as the browser
-- Pixel event — matching event_id alone is often not enough. The browser sends
-- these to verify-payment, which stores them here so fulfillPayment() (incl.
-- webhook/reconcile paths) can include them on the server event.
--
-- Non-PII identifiers; safe to store as-is. Run in the Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta_fbp TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta_fbc TEXT;
