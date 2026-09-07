-- Owner "New Sale" notification idempotency flag.
--
-- WHY: notifyOwner() previously fired on every fulfillPayment() call, so a
-- reconcile-payments pass over already-completed paid reports re-sent the
-- owner "New Sale!" email for OLD sales. This column lets notifyOwner claim it
-- atomically (UPDATE ... WHERE owner_notified_at IS NULL) so the email is sent
-- at most ONCE per report, ever.
--
-- Run this in the Supabase SQL Editor.

ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_notified_at TIMESTAMPTZ;

-- BACKFILL: mark every EXISTING paid report as already-notified, so the
-- reconcile cron never emails the owner about old sales again. New sales going
-- forward start with owner_notified_at = NULL and notify exactly once.
UPDATE reports
   SET owner_notified_at = COALESCE(owner_notified_at, paid_at, created_at, now())
 WHERE payment_status = 'paid'
   AND owner_notified_at IS NULL;
