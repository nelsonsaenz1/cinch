-- Datafeedr's plan facts, read from its own POST /status on 2026-08-11:
--   max_requests 10000 · bill_day 11 · max_length 100
--
-- Recorded as a migration rather than a one-off UPDATE so that a rebuilt
-- database throttles from the first request instead of treating a null
-- `limit_total` as "do not throttle" and spending the month in a fortnight.
-- `used` is deliberately NOT set here: it is a point-in-time count, not a plan
-- fact, and a rebuild starting from 0 is the correct reading of a fresh ledger.
update catalog_quota
   set limit_total = 10000,
       bill_day    = 11,
       cycle_start = catalog_cycle_start(11::smallint, now()),
       updated_at  = now()
 where provider = 'datafeedr';
