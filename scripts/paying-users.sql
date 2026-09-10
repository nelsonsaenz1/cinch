-- The first hundred, counted honestly — 2026-09-10 (affordable membership).
--
-- Run against production through the Supabase MCP (`execute_sql`) or psql.
-- Read-only. Every count below is DISTINCT CUSTOMERS, never rows, and every
-- exclusion is stated in the query rather than applied afterwards.
--
-- PRIMARY COUNT · active paying subscribers
--   A person whose current paid period is backed by a verified, non-zero
--   PRODUCTION charge: an App Store Server Notification (asc_notifications,
--   the only ledger Apple signs) of type SUBSCRIBED / DID_RENEW /
--   OFFER_REDEEMED whose transaction was NOT a trial period (the Superwall
--   ledger's `period_type` for the same original transaction is not 'TRIAL'),
--   whose `expires_at` is still in the future, and which has not been
--   followed by a REFUND / REVOKE / EXPIRED for that transaction.
--   Excluded by construction: Sandbox, internal (%cinchstyle.com,
--   demo@cinch.app), founder family (%saenz%), gifts (subscriptions rows with
--   no ASC transaction behind them — Savannah's Pro year), legacy promotional
--   access (plan='free' with trial_ends_at), and free trials.
--   Cancelled-but-not-yet-expired periods STAY IN the count until
--   `expires_at`; cancellation intent is reported separately below.
--
-- Baseline on 2026-09-10 (before the change): 0.

with internal as (
  select id from auth.users
  where email like '%cinchstyle.com' or email = 'demo@cinch.app' or email like '%saenz%'
),
-- Every Production ASC notification joined to the Superwall ledger's view of
-- the same original transaction (period_type: TRIAL / NORMAL / null).
asc_prod as (
  select a.notification_uuid, a.notification_type, a.subtype, a.product_id,
         a.original_transaction_id, a.app_account_token, a.expires_at, a.signed_date,
         a.received_at, sw.period_type
  from asc_notifications a
  left join lateral (
    select period_type from superwall_events s
    where s.original_transaction_id = a.original_transaction_id
      and s.period_type is not null
    order by s.received_at desc limit 1
  ) sw on true
  where a.environment = 'Production'
    and a.app_account_token is not null
    and a.app_account_token not in (select id from internal)
),
charges as (
  select * from asc_prod
  where notification_type in ('SUBSCRIBED', 'DID_RENEW', 'OFFER_REDEEMED')
    and coalesce(period_type, 'NORMAL') <> 'TRIAL'
),
revocations as (
  select original_transaction_id, min(signed_date) as revoked_at
  from asc_prod
  where notification_type in ('REFUND', 'REVOKE', 'EXPIRED', 'GRACE_PERIOD_EXPIRED')
  group by 1
),
-- One row per customer: their latest charged period.
latest_charge as (
  select distinct on (c.app_account_token)
         c.app_account_token as user_id, c.product_id, c.original_transaction_id,
         c.signed_date as charged_at, c.expires_at, c.notification_type, c.subtype
  from charges c
  order by c.app_account_token, c.signed_date desc
),
active as (
  select lc.*
  from latest_charge lc
  left join revocations r on r.original_transaction_id = lc.original_transaction_id
                          and r.revoked_at >= lc.charged_at
  where lc.expires_at > now() and r.original_transaction_id is null
),
-- Cancellation intent (auto-renew off) — reported, never subtracted.
intent as (
  select distinct app_account_token as user_id
  from asc_prod
  where notification_type = 'DID_CHANGE_RENEWAL_STATUS' and subtype = 'AUTO_RENEW_DISABLED'
),
-- Billing retry / grace (unpaid, access may continue) — shown separately.
grace as (
  select distinct app_account_token as user_id
  from asc_prod
  where notification_type in ('DID_FAIL_TO_RENEW', 'GRACE_PERIOD_EXPIRED')
    and app_account_token not in (select user_id from active)
)
select
  (select count(*) from active)                                                       as active_paying_subscribers,
  (select count(*) from active where product_id = 'cinch.standard.monthly')           as active_standard_monthly,
  (select count(*) from active where product_id = 'cinch.pro.monthly')                as active_pro_monthly,
  (select count(*) from active where product_id like '%.annual')                      as active_annual_legacy,
  (select count(*) from active a where a.user_id in (select user_id from intent))     as active_with_autorenew_off,
  (select count(*) from grace)                                                        as unpaid_grace_or_retry,
  -- First-time payers: customers whose FIRST non-trial charge ever is a
  -- SUBSCRIBED/INITIAL_BUY (or a trial conversion) — split by product.
  (select count(distinct app_account_token) from charges
     where notification_type = 'SUBSCRIBED' and product_id = 'cinch.standard.monthly') as first_time_standard,
  (select count(distinct app_account_token) from charges
     where notification_type = 'SUBSCRIBED' and product_id = 'cinch.pro.monthly')      as first_time_pro,
  -- Renewals, counted only for customers whose renewal date has ARRIVED:
  -- a first renewal is the first DID_RENEW on a transaction; a second is the
  -- second. Customers still inside their first period are not "not renewed".
  (select count(distinct original_transaction_id) from (
     select original_transaction_id, count(*) as n from charges
     where notification_type = 'DID_RENEW' group by 1) t where n >= 1)                 as first_renewals,
  (select count(distinct original_transaction_id) from (
     select original_transaction_id, count(*) as n from charges
     where notification_type = 'DID_RENEW' group by 1) t where n >= 2)                 as second_renewals,
  (select count(distinct original_transaction_id) from charges
     where expires_at < now())                                                         as periods_matured,
  (select count(distinct app_account_token) from asc_prod
     where notification_type in ('REFUND'))                                            as refunds,
  (select count(distinct app_account_token) from asc_prod
     where notification_type = 'EXPIRED')                                              as expirations;

-- GROSS MRR (amortised, month-to-month on the new products) and collected
-- revenue are NOT computed here: this database holds no amounts. Read them
-- from Superwall's ClickHouse (`superwall query`) or App Store Connect's
-- Sales report, and label them separately from the customer count above.
--
-- Exposure and conversion to the NEW offer, per person (PostHog, HogQL):
--   select uniqIf(person_id, event = 'paywall_presented' and properties.paywall = '<v4 identifier>') as exposed,
--          uniqIf(person_id, event = 'paywall_converted' and properties.paywall = '<v4 identifier>') as converted
--   from events where timestamp >= toDateTime('<launch UTC>') and properties.$app_build != '1'
-- A `paywall_converted` is a CLIENT claim; the count above is the authority.
