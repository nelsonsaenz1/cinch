-- The personal invite link (IV-01…IV-06).
--
-- There is no invites table, and that is the design rather than an omission.
-- The atlas's first rule is "one link per person, forever — the handle is the
-- link", so a per-invite code would be a row nobody asked for and a thing to
-- revoke that nobody wanted revocable. What IS recorded is the only fact the
-- app can honestly know: who arrived through whose link, written once at the
-- moment of arrival.
--
-- This is also why IV-01's "Waiting on" list could not be built as drawn. It
-- showed named recipients with send times; with no codes and no address-book
-- access there is no way to know a link was sent to anybody, let alone when.
-- The section became "Came in from your link", which is this column read back.
-- See the contract, §3.
alter table public.profiles
  add column invited_by uuid references auth.users (id) on delete set null,
  add column invited_at timestamptz;

comment on column public.profiles.invited_by is
  'Whose invite link this account arrived through. Written once, at first apply; never edited.';

create index profiles_invited_by_idx
  on public.profiles (invited_by)
  where invited_by is not null;

/**
 * invite_card — what the landing page is allowed to know.
 *
 * The web page at cinchstyle.com/i/@handle renders before anyone has signed
 * in, so it needs one fact from an unauthenticated caller: the display name
 * behind a handle. This function is the whole of that permission.
 *
 * It returns the display name and nothing else — no user id, no avatar, no
 * bio, no counts, no join date. A definer function with a single scalar out
 * is the narrowest shape this can take; the standing refusal against `to anon`
 * policies on base tables is about exactly the thing this avoids, which is
 * handing the anonymous role a seat at a table it can then explore.
 *
 * The residual exposure is handle enumeration returning display names. That is
 * accepted knowingly: a handle is already resolvable by any signed-in user
 * through the friend search, and the inviter published this particular handle
 * on purpose by sending the link.
 *
 * An account mid-deletion resolves to nothing, so a link stops working the
 * moment its owner leaves — which is the IV-05 branch.
 */
create function public.invite_card(p_handle text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select p.display_name
    from public.profiles p
   where p.username = lower(ltrim(p_handle, '@'))
     and p.deletion_requested_at is null
   limit 1;
$$;

revoke all on function public.invite_card(text) from public;
grant execute on function public.invite_card(text) to anon, authenticated;

/**
 * apply_invite — arriving through someone's link.
 *
 * "The invite is already accepted": coming in through a link MAKES the
 * friendship, so this writes both follow rows rather than a request. IV-06
 * reports the result, it does not ask for a confirmation the user already
 * gave by tapping the link.
 *
 * Idempotent and one-way. `invited_by` is written only when it is still null,
 * so re-opening the link never re-attributes an account, and the follows are
 * `on conflict do nothing` so a second tap is a no-op rather than an error.
 *
 * Refuses to make you your own friend, and refuses across a block in either
 * direction — a link must not be a way back in for someone who was blocked.
 * Returns the inviter's name for IV-06's headline, or null when there is
 * nobody to be friends with, which is what the caller shows IV-05 for.
 */
create function public.apply_invite(p_handle text)
returns table (inviter_id uuid, display_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_inviter uuid;
  v_name    text;
begin
  if v_user is null then
    raise exception 'you need to be signed in' using errcode = '28000';
  end if;

  select p.user_id, p.display_name
    into v_inviter, v_name
    from public.profiles p
   where p.username = lower(ltrim(p_handle, '@'))
     and p.deletion_requested_at is null
   limit 1;

  if v_inviter is null or v_inviter = v_user then
    return;
  end if;

  if exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = v_inviter and b.blocked_id = v_user)
        or (b.blocker_id = v_user and b.blocked_id = v_inviter)
  ) then
    return;
  end if;

  update public.profiles
     set invited_by = v_inviter,
         invited_at = now()
   where user_id = v_user
     and invited_by is null;

  insert into public.follows (follower_id, followee_id)
  values (v_user, v_inviter), (v_inviter, v_user)
  on conflict do nothing;

  inviter_id := v_inviter;
  display_name := v_name;
  return next;
end;
$$;

revoke all on function public.apply_invite(text) from public;
grant execute on function public.apply_invite(text) to authenticated;

/**
 * invite_arrivals — "Came in from your link" (IV-01).
 *
 * Definer for the same reason activity_feed() is: a profile row is not
 * readable by an arbitrary viewer, and the honest answer to "who joined
 * through me" is a fact about the caller, not about the people listed. Takes
 * the user from auth.uid(), returns only what the row on IV-01 prints.
 */
create function public.invite_arrivals()
returns table (user_id uuid, display_name text, username text, joined_at timestamptz)
language sql
security definer
stable
set search_path = ''
as $$
  select p.user_id, p.display_name, p.username, p.invited_at
    from public.profiles p
   where p.invited_by = (select auth.uid())
     and p.deletion_requested_at is null
   order by p.invited_at desc
   limit 50;
$$;

revoke all on function public.invite_arrivals() from public;
grant execute on function public.invite_arrivals() to authenticated;
