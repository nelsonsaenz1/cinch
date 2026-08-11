-- Every Superwall delivery, recorded once. Audit item 23.
--
-- WHY A LEDGER AND NOT A DEDUPE FLAG
--
-- Svix guarantees AT-LEAST-ONCE delivery. The webhook already handles
-- out-of-order arrival (`expirationAt` decides recency) but has nothing at all
-- for repeat arrival: a redelivered `purchase` re-applies the same plan write,
-- and a redelivered event whose `expirationAt` ties the stored one is applied
-- again rather than recognised as the same event. Today that is mostly benign
-- because the write is idempotent by luck — same plan, same period. It stops
-- being benign the moment anything downstream counts events, and it is already
-- not benign for reconciliation, because there is no record of what arrived.
--
-- So this stores the delivery ITSELF, keyed on Svix's own message id, before
-- any decision is made about it. `svix-id` is the right key rather than
-- anything in the payload: it identifies a DELIVERY ATTEMPT SET — every retry
-- of one logical event carries the same id, and two genuinely different events
-- never share one.
--
-- THIS LANDS BEFORE THE ALIAS WORK ON PURPOSE (audit 24). Reconciling
-- `$SuperwallAlias:` purchases means replaying events that were refused at the
-- time, and there is currently no record of them to replay — the handler logs
-- an error and returns 200. A queue with nothing in it cannot be drained.

create type superwall_outcome as enum (
  'applied',            -- a plan was written
  'no_state_change',    -- a real event that changes nothing (cancellation, billing_issue)
  'unidentified_alias', -- purchase before identify() — needs reconciliation
  'unmapped_product',   -- productId not in PRODUCT_PLANS; retried by Svix
  'stale',              -- superseded by a period already stored
  'duplicate'           -- this svix-id has been seen before
);

create table superwall_events (
  -- Svix's message id. One row per logical event, however many times it is
  -- delivered.
  svix_id text primary key,
  event_type text not null,
  -- The raw `originalAppUserId`, INCLUDING a `$SuperwallAlias:` prefix — the
  -- alias is the thing the reconciliation queue needs to match on later.
  app_user_id text not null,
  product_id text,
  original_transaction_id text,
  expiration_at timestamptz,
  outcome superwall_outcome not null,
  -- The plan that was written, when one was.
  plan text check (plan is null or plan in ('free', 'standard', 'pro')),
  received_at timestamptz not null default now(),
  -- Bumped on every redelivery, so a pathological retry loop is visible.
  delivery_count integer not null default 1 check (delivery_count > 0),
  last_delivery_at timestamptz not null default now()
);

comment on table superwall_events is
  'One row per Superwall webhook delivery, keyed on svix-id. Written BEFORE the plan decision so a refused event is still recorded — see the unidentified_alias reconciliation queue.';

create index superwall_events_alias_idx
  on superwall_events (app_user_id)
  where outcome = 'unidentified_alias';

create index superwall_events_txn_idx
  on superwall_events (original_transaction_id)
  where original_transaction_id is not null;

alter table superwall_events enable row level security;
-- No policies. Service role and security-definer functions only; this holds
-- transaction identifiers and is nobody's business from the client.

-- ---------------------------------------------------------------------------
-- Claim a delivery.
--
-- Returns TRUE when this is the first time this `svix-id` has been seen and the
-- caller should go on to apply it; FALSE when it is a redelivery, which the
-- caller answers 200 to without touching anything.
--
-- The decision and the record are one statement, for the same reason
-- `claim_catalog_request` is: two concurrent redeliveries of one event must not
-- both believe they are first.
-- ---------------------------------------------------------------------------
create function claim_superwall_event(
  p_svix_id text,
  p_event_type text,
  p_app_user_id text,
  p_product_id text default null,
  p_original_transaction_id text default null,
  p_expiration_at timestamptz default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_inserted boolean;
begin
  insert into public.superwall_events (
    svix_id, event_type, app_user_id, product_id,
    original_transaction_id, expiration_at, outcome
  )
  values (
    p_svix_id, p_event_type, p_app_user_id, p_product_id,
    p_original_transaction_id, p_expiration_at, 'no_state_change'
  )
  on conflict (svix_id) do update
     set delivery_count   = public.superwall_events.delivery_count + 1,
         last_delivery_at = now()
  returning (xmax = 0) into v_inserted;

  return v_inserted;
end;
$$;

revoke execute on function claim_superwall_event(text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

-- Record what was decided, once the handler knows.
create function note_superwall_outcome(
  p_svix_id text,
  p_outcome superwall_outcome,
  p_plan text default null
) returns void
language sql security definer set search_path = '' as $$
  update public.superwall_events
     set outcome = p_outcome, plan = p_plan
   where svix_id = p_svix_id;
$$;

revoke execute on function note_superwall_outcome(text, superwall_outcome, text)
  from public, anon, authenticated;
