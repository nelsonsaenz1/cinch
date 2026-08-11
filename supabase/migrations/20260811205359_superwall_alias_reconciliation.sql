-- Audit item 24: drain the queue that item 23 started filling.
--
-- A purchase made before `identify()` is attributed to Superwall's anonymous
-- `$SuperwallAlias:<uuid>`, which maps to no Supabase user, so no plan is
-- written. Item 23 stopped that being only a log line. This is the part that
-- gives the money back to the person who paid it.
--
-- WHY THE ALIAS IS ACCEPTABLE PROOF
--
-- The claim is made by the app, over an authenticated call, carrying the alias
-- SuperwallKit generated on that device. The alias is a v4 UUID — 122 random
-- bits — created locally, stored locally, and never sent to any other client.
-- Guessing one is not a threat model. Learning one requires already being on
-- the device that made the purchase, which is also what would let you restore
-- the purchase through Apple.
--
-- Two things still have to hold, and they are the reason this is a function and
-- not a query:
--
--   1. ONE claim. Once an alias is bound to a user it is bound forever, even if
--      the same alias is presented again by somebody else.
--   2. ATOMICALLY. Two concurrent sign-ins presenting the same alias must not
--      both come away believing they own the purchase, or the plan gets written
--      twice for two different users.
--
-- A shared device is the case worth naming: if person A buys anonymously and
-- person B is the first to sign in on that device, B gets it. That matches how
-- the App Store itself behaves — the entitlement follows the device's Apple ID,
-- and B could equally have tapped Restore Purchases — so it is the platform's
-- answer, not a new hole.

alter type superwall_outcome add value if not exists 'reconciled';

alter table superwall_events
  add column reconciled_user_id uuid references auth.users (id) on delete set null,
  add column reconciled_at timestamptz;

comment on column superwall_events.reconciled_user_id is
  'The user an unidentified_alias event was eventually bound to. Set once, by claim_superwall_alias, and never rewritten.';

-- Finds an alias queue fast, and — because it is partial — only indexes the rows
-- that are actually waiting.
create index superwall_events_unreconciled_idx
  on superwall_events (app_user_id)
  where outcome = 'unidentified_alias' and reconciled_user_id is null;
