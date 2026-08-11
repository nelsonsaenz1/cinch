-- Audit 24. Bind an anonymous alias to the user who has just proved they hold
-- it, and hand back the events that were waiting.
--
-- Returns the claimed rows. An empty result is the overwhelmingly common case —
-- most sign-ins follow no anonymous purchase at all — and is not an error.
--
-- SECURITY DEFINER because `superwall_events` has RLS on and no policies: the
-- table holds transaction identifiers and stays unreachable from any client.
-- This function is the one narrow window onto it, and it only ever returns rows
-- matching an alias the caller already supplied.
create function claim_superwall_alias(p_alias text, p_user_id uuid)
returns table (
  svix_id text,
  event_type text,
  product_id text,
  expiration_at timestamptz
)
language plpgsql security definer set search_path = '' as $$
begin
  -- Refuse anything that is not a well-formed SuperwallKit alias before it
  -- reaches an index. `IdentityLogic.generateAlias()` is the prefix plus a
  -- `UUID().uuidString`; anything else did not come from the SDK.
  if p_alias is null or p_alias !~ '^\$SuperwallAlias:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return;
  end if;

  if p_user_id is null then
    return;
  end if;

  -- One statement, so two concurrent claims cannot both succeed. The
  -- `reconciled_user_id is null` predicate is re-checked by the UPDATE under
  -- row locks: the loser of a race finds the row already bound and matches
  -- nothing, rather than reading "unclaimed" and then overwriting the winner.
  --
  -- Note it does NOT move `outcome` off `unidentified_alias`. The outcome
  -- records what the WEBHOOK decided and stays a true account of that; the
  -- reconciliation is a separate fact in its own columns. Overwriting it would
  -- erase the evidence that the identity-timing bug happened at all, which is
  -- the signal worth keeping — more than one of these means the bug is in
  -- identity timing, not billing.
  return query
  update public.superwall_events e
     set reconciled_user_id = p_user_id,
         reconciled_at      = now()
   where e.app_user_id = p_alias
     and e.outcome = 'unidentified_alias'
     and e.reconciled_user_id is null
  returning e.svix_id, e.event_type, e.product_id, e.expiration_at;
end;
$$;

revoke execute on function claim_superwall_alias(text, uuid) from public, anon, authenticated;

comment on function claim_superwall_alias(text, uuid) is
  'Audit 24. Atomically binds every unclaimed unidentified_alias event for this alias to this user and returns them for replay. Service role only — the caller must have already authenticated the user.';

-- The operator surface for what CANNOT be fixed automatically: a purchase whose
-- device never signed in, or signed in after a reinstall that rotated the alias.
-- These need a human with App Store Connect and the transaction id.
create view superwall_unreconciled as
  select svix_id,
         app_user_id as alias,
         event_type,
         product_id,
         original_transaction_id,
         received_at,
         delivery_count
    from public.superwall_events
   where outcome = 'unidentified_alias'
     and reconciled_user_id is null
   order by received_at;

comment on view superwall_unreconciled is
  'Paying customers with no entitlement, still unclaimed. Each needs the originalTransactionId looked up in App Store Connect and the subscriptions row set by hand. A steadily non-empty list means identify() is running too late, not that billing is broken.';

revoke all on superwall_unreconciled from public, anon, authenticated;
