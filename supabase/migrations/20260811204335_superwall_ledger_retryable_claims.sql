-- Audit 23, follow-up: stop the ledger from turning a recoverable failure into
-- a permanent one.
--
-- THE BUG THIS FIXES
--
-- The handler has two paths that fail ON PURPOSE in order to be retried:
--
--   * `unmapped_product` answers 422 because the fix is to add the product to
--     PRODUCT_PLANS and redeploy, after which Svix's redelivery succeeds.
--   * a failed subscription write answers 500 because the next attempt may well
--     work.
--
-- Both depend on redelivery actually re-running the handler. The first cut of
-- the ledger broke exactly that: the retry found the `svix-id` already claimed,
-- answered `duplicate`, and returned 200 without applying anything. Svix, told
-- the delivery succeeded, stopped retrying. A purchase that was one redeploy
-- away from being applied became permanently unapplied, and the deliberate 422
-- became a lie.
--
-- So a claim is no longer "have I seen this id" but "have I FINISHED with this
-- id". An outcome that represents unfinished business is claimable again.
create or replace function claim_superwall_event(
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
  v_outcome text;
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
  returning (xmax = 0), outcome::text into v_inserted, v_outcome;

  -- First time: apply it.
  if v_inserted then
    return true;
  end if;

  -- Seen before, but never finished. Let the retry do what the 422 or the 500
  -- promised it would. `applied`, `stale`, `no_state_change` and
  -- `unidentified_alias` are all terminal and stay refused — an applied
  -- purchase must never be re-applied by a redelivery, which is the whole
  -- point of the ledger.
  return v_outcome in ('unmapped_product', 'write_failed');
end;
$$;

revoke execute on function claim_superwall_event(text, text, text, text, text, timestamptz)
  from public, anon, authenticated;

comment on function claim_superwall_event(text, text, text, text, text, timestamptz) is
  'Returns true when the caller should process this delivery: either the svix-id is new, or a previous attempt ended in a retryable outcome (unmapped_product, write_failed). Terminal outcomes return false so redelivery is a no-op.';
