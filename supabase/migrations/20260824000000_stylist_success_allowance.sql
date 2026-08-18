-- The Stylist's PRODUCT allowance, which is not the same number as its ceiling.
--
-- ── THE DEFECT THIS CLOSES ──────────────────────────────────────────────────
--
-- Standard is sold "five chats a month". The only counter that existed was
-- `claim_ai_quota`, which counts ATTEMPTS and is set to eight — deliberately,
-- as slack so that five stay deliverable through a failed call or two. Those
-- are two different facts about two different things, and the screen had no
-- way to say the first one. Redesign 16 shipped its chats-left mark dark for
-- exactly this reason.
--
-- Exposing the attempt counter as "chats" was refused: it would tell somebody
-- they had eight, and the eighth is the one they would remember.
--
-- ── WHY RESERVE-AND-RELEASE RATHER THAN COUNT-ON-SUCCESS ────────────────────
--
-- The promise is five SUCCESSFUL chats, so the naive shape is to increment
-- after the provider answers. That shape cannot keep the boundary truthful:
-- two devices both read four, both call, both succeed, and the account has had
-- six. A check that happens before the write it is protecting is not a check.
--
-- So the slot is RESERVED atomically before the provider call — the conditional
-- `where c.calls < p_limit` on the upsert is the lock, and two racing
-- transactions serialise on the row so only one can take the last slot — and
-- RELEASED if the provider never answers. The counter therefore holds
-- successes at rest, and the fifth boundary is true across devices.
--
-- ── WHY NO NEW TABLE ────────────────────────────────────────────────────────
--
-- `ai_usage_counters` is keyed by (user_id, kind, period, period_start), so a
-- distinct `kind` is a distinct row and nothing else moves. No column, no
-- index, no policy, no grant beyond these two functions. The attempt counter
-- keeps its own `stylist_chat` rows and its own meaning, untouched — and
-- `enforceAiQuota`, which seven production functions share, is not modified at
-- all.
--
-- ── SCOPE ───────────────────────────────────────────────────────────────────
--
-- STANDARD ONLY. Free is refused earlier by `claim_ai_quota` as
-- `plan_excluded` (402), which is a boundary rather than exhaustion. Pro is
-- unlimited as a product and never reserves here; its 100/day ceiling exists
-- to stop a script and is never presented as an allowance.

create or replace function public.claim_stylist_success(p_user_id uuid, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_used  integer;
begin
  -- A non-positive limit is not this function's business. Free is refused by
  -- the plan check before anything reaches here, and answering "allowed" for a
  -- zero limit would be a second, quieter place for that decision to live.
  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false, 'used', 0, 'limit', 0, 'remaining', 0, 'reason', 'plan_excluded'
    );
  end if;

  -- UTC, and the same boundary `claim_ai_quota` truncates to. Supabase runs in
  -- UTC; two counters that disagreed about when a month starts would hand the
  -- reader a reset date the server does not honour.
  v_start := date_trunc('month', now() at time zone 'utc')::date;

  insert into public.ai_usage_counters as c (user_id, kind, period, period_start, calls)
  values (p_user_id, 'stylist_success', 'month', v_start, 1)
      on conflict (user_id, kind, period, period_start)
      do update set calls = c.calls + 1
       where c.calls < p_limit
  returning calls into v_used;

  if v_used is null then
    -- The conditional update matched nothing: the allowance is spent. Read the
    -- settled value back so the refusal carries the same fact the client would
    -- have been shown on success.
    select calls into v_used
      from public.ai_usage_counters
     where user_id = p_user_id and kind = 'stylist_success'
       and period = 'month' and period_start = v_start;

    return jsonb_build_object(
      'allowed', false,
      -- Clamped to the limit: the counter can never exceed it through this
      -- function, and a display figure larger than the promise would be a
      -- number nobody can explain.
      'used', least(coalesce(v_used, p_limit), p_limit),
      'limit', p_limit,
      'remaining', 0,
      'reason', 'exhausted'
    );
  end if;

  return jsonb_build_object(
    'allowed', true,
    'used', v_used,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_used)
  );
end;
$$;

-- Give the slot back when the provider never answered.
--
-- "A failed call does not spend a chat" is the promise the eight-attempt slack
-- was invented to keep, and this is where it becomes true of the number the
-- reader actually sees. Floored at zero so a double release — a retry that
-- races its own timeout — cannot drive the counter negative and hand somebody
-- a sixth chat.
create or replace function public.release_stylist_success(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_used  integer;
begin
  v_start := date_trunc('month', now() at time zone 'utc')::date;

  update public.ai_usage_counters
     set calls = greatest(0, calls - 1)
   where user_id = p_user_id and kind = 'stylist_success'
     and period = 'month' and period_start = v_start
  returning calls into v_used;

  return jsonb_build_object('used', coalesce(v_used, 0));
end;
$$;

-- Service role only, on the same rule every counter function here follows: a
-- client that could call this could grant itself chats. The Edge Function holds
-- the service key; nothing else may reach these.
revoke all on function public.claim_stylist_success(uuid, integer) from public;
revoke all on function public.claim_stylist_success(uuid, integer) from anon;
revoke all on function public.claim_stylist_success(uuid, integer) from authenticated;
grant execute on function public.claim_stylist_success(uuid, integer) to service_role;

revoke all on function public.release_stylist_success(uuid) from public;
revoke all on function public.release_stylist_success(uuid) from anon;
revoke all on function public.release_stylist_success(uuid) from authenticated;
grant execute on function public.release_stylist_success(uuid) to service_role;

comment on function public.claim_stylist_success(uuid, integer) is
  'Reserves one of Standard''s five monthly successful stylist chats. Atomic: the conditional upsert is the boundary, so two devices cannot both take the last slot. Released by release_stylist_success when the provider fails.';

comment on function public.release_stylist_success(uuid) is
  'Returns a reserved stylist chat slot after a failed provider call. Floored at zero so a double release cannot grant a sixth chat.';
