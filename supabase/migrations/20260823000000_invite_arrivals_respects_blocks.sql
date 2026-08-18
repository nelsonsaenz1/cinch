-- invite_arrivals() listed people the caller had since blocked.
--
-- THE DEFECT. The function answers "whose `invited_by` is me", filtered only by
-- `deletion_requested_at`. `profiles.invited_by` is written ONCE by
-- `apply_invite` and never cleared, so the roster is permanent — while a block
-- is not merely a later event, it is the app's strongest privacy promise, and
-- everywhere else in this schema it means mutual invisibility. `is_friend()`
-- refuses across a block, `social_profiles` refuses across a block,
-- `friend_worn_outfits` refuses across a block, and `on_block_sever_graph`
-- deletes both follow edges outright. This one function did not ask, so a
-- blocked person kept a row on the inviter's Invite / Share page with their
-- display name and handle on it.
--
-- Found by audit while building redesign 10, not by anybody hitting it: today
-- `user_blocks` is empty and no profile carries an `invited_by`, so the fix
-- changes zero live rows. It is a lock fitted before the door is used.
--
-- ── THE SEMANTICS, STATED SO THEY CAN BE ARGUED WITH ────────────────────────
--
-- BLOCKED, EITHER DIRECTION → ABSENT. Blocking is symmetric and total. It does
-- not matter who blocked whom, and it does not matter that the arrival really
-- did come in through the link: a block means the two people stop seeing each
-- other in Cinch, and a private roster is still seeing.
--
-- UNFRIENDED → RETAINED, DELIBERATELY. `apply_invite` creates the friendship
-- and a removal can undo it, so it is tempting to require a current friendship
-- here too. That would be wrong. An arrival is a fact about the CALLER'S OWN
-- LINK — "this person joined Cinch through something I sent" — and it stays
-- true after a friendship ends. Requiring friendship would quietly turn the
-- roster into a friends list, and it would contradict the page's own contract,
-- which says in as many words that an arrival never proves friendship, mutual
-- authorization or closet visibility. A row that disappeared when a friendship
-- ended would prove exactly those things by its absence.
--
-- PROFILE VISIBILITY → NOT A FILTER, considered and declined. `social_profiles`
-- gates on `visibility` because it answers "who may I look up". This function
-- answers a different question, about the caller, and the person listed opted
-- into the association by using a link that names the inviter. Adding a
-- visibility filter here would be a second semantic change nobody asked for.
--
-- DELETION REQUESTED → ABSENT, unchanged.
--
-- ── WHY THIS SHAPE ─────────────────────────────────────────────────────────
--
-- `create or replace` with the identical signature, so the function's OID, its
-- dependencies and its existing grants all survive; the revoke/grant pair below
-- is re-issued anyway so the file is correct when replayed onto a database
-- where the function does not yet exist. Nothing else in the schema moves: no
-- new table, column, index, policy or type, and the returned columns are
-- byte-for-byte what the client already reads, so no generated type changes.
--
-- `public.blocked_between` rather than an inline `exists` over `user_blocks`:
-- it is the one definition of "blocked" in this schema, it already covers both
-- directions, and a second hand-written copy of that predicate is how two
-- answers to one question start.
-- APPLIED TO PRODUCTION as ledger version `20260818055848`, name
-- `invite_arrivals_respects_blocks`, via the Supabase MCP `apply_migration`
-- (never `supabase db push`). The ledger version differs from this filename
-- for the reason `docs/ops/supabase-migration-reconciliation-20260817.md`
-- records: the MCP route stamps its own clock time, while the filename carries
-- the repo's round timestamp. Same statements, two version strings — written
-- down here so the next reconciliation reads it as expected rather than as a
-- second, missing migration.
create or replace function public.invite_arrivals()
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
     and not public.blocked_between((select auth.uid()), p.user_id)
   order by p.invited_at desc
   limit 50;
$$;

revoke all on function public.invite_arrivals() from public;
revoke all on function public.invite_arrivals() from anon;
grant execute on function public.invite_arrivals() to authenticated;
