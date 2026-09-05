-- Meta Conversions API idempotency flag.
-- Stamped by fulfillPayment() once the server-side Purchase event has been
-- reported to Meta, so retries / multiple fulfilment paths (browser +
-- webhook + reconcile) never double-report the same purchase.
--
-- The code is fail-soft: if this column doesn't exist yet, the CAPI send is
-- simply skipped (never blocks fulfilment). Run this in the Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS meta_purchase_sent_at TIMESTAMPTZ;
