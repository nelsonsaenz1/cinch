-- ===========================================================================
-- The five senders' half of the promise: who is due, claimed atomically.
--
-- Atlas 37's governing rule is that "the description is the promise". Each of
-- the five functions below is one row of that screen, and each one's comment
-- names the dedupe key that makes its sentence true. Nothing here composes
-- copy and nothing here talks to Apple — that is `send-push`. These decide who,
-- and they decide it exactly once.
--
-- ── WHY THE CLAIM IS THE FIRST THING THAT HAPPENS ──────────────────────────
--
-- Every function has the same shape:
--
--   with due as (…who is owed a message…)
--   insert into push_sends (user_id, channel, dedupe_key)
--   select … from due
--   on conflict do nothing
--   returning *
--
-- The insert IS the decision. `push_sends`' three-column primary key
-- (20260810100300) is what enforces "once a day" and "at most one an hour";
-- the sender does not check whether it already sent, it tries to book the slot
-- and is told. That distinction matters under concurrency: two overlapping
-- sweeps both compute the same `due` set, and exactly one of them gets the row
-- back. A `select … where not exists (…)` followed by an insert would let both
-- through, and the reader would get two morning edits.
--
-- Because the ledger row is written before Apple is ever contacted, a send that
-- fails outright leaves a booking for a message nobody received. `send-push`
-- releases the claim in that case and only in that case; see the comment there,
-- because the trade is real and deliberate.
--
-- ── WHY THEY ARE DEFINER ───────────────────────────────────────────────────
--
-- Not to give a client a read it could not do — no client can call these at
-- all. It is so the read is identical whichever service-side caller arrives:
-- `pg_cron` runs jobs as `postgres`, the edge function connects as
-- `service_role`, and both must see the same rows and be able to reach
-- `blocked_between`, which is itself definer and granted to nobody else. The
-- surface is closed by the revoke at the foot of this file rather than by
-- argument checking, because these functions take no arguments: there is
-- nothing to widen.
--
-- ── WHAT EVERY CHANNEL FILTERS, WITHOUT EXCEPTION ──────────────────────────
--
--   * the channel's own boolean on `notification_prefs` — and the row must
--     EXIST. There is no left join to the column defaults, because permission
--     is asked for "the first time a channel is switched on" (atlas 37), so a
--     person with a token has been through that screen and has a row. No row,
--     no permission, no token, nothing to send.
--   * at least one device in `push_tokens`. Claiming a slot for a person with
--     no device would burn the day's morning edit on nothing.
--   * `profiles.deletion_requested_at is null` — an account in its deletion
--     grace period is not one to go on ringing.
--   * `blocked_between`, on every channel where another person is the cause.
--
-- What it does NOT filter is the Lately mute, which is deliberately device-
-- local (`20260810100100` says so), so the server cannot see it, and quiet
-- hours, which atlas 37 gives to the phone: "Quiet hours follow your phone's
-- Do Not Disturb. Cinch adds none of its own." The hourly batches therefore
-- run through the night and iOS decides whether to make a sound.
--
-- See docs/design/diary-boards-activity-contract.md §6.3.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Morning edit.
--
--   Promise: one notification at the slot the reader chose, when the day's
--   look is ready to read. Once a day, never twice.
--
--   THE SLOT IS PER USER, AND 07:30 IS ONLY THE DEFAULT. NP-04 offers four
--   times and the screen's own description is written from the chosen one — a
--   reader on 06:30 is shown a sentence that says 6:30am. So the comparison
--   below is against `n.morning_edit_at`, never against a constant, and the
--   dedupe key is the local DATE rather than the slot: keyed on the slot, a
--   reader who moved 07:30 to 08:00 at ten past seven would be owed a second
--   edit the same morning.
--
--   It is also a `time`-to-`time` comparison, deliberately, and not a string
--   one. `morning_edit_at` is a `time` column and Postgres renders it as
--   `07:30:00`; anything comparing it to the text '07:30' the CHECK constraint
--   is written in matches nothing at all, and would do so silently.
--
--   DEDUPE KEY: the reader's LOCAL calendar date, `2026-08-10`. A day is the
--   unit the promise is written in, and it has to be their day — keyed on the
--   UTC date, everyone west of Greenwich would be eligible twice on the same
--   morning. The key is computed from `profiles.time_zone`, which is also why
--   a null zone sends nothing at all (20260810110000).
--
--   The window: fired when local time has passed the chosen slot, and dropped
--   two hours later. Without the ceiling, an account that first gets a token at
--   eleven at night qualifies instantly — 23:00 is after 07:30 and no row
--   exists for today — and the "morning" edit arrives at bedtime. Two hours is
--   slack for a sweep that missed a run; past that, a missed morning is a
--   missed morning, and the edit waits for tomorrow rather than arriving as a
--   lie about the time.
--
--   The cron runs at :00, :15, :30 and :45, which lands exactly on all four
--   slots for every zone in real use — even the half-hour and quarter-hour
--   offsets (Kolkata's local 07:30 is 02:00 UTC, Kathmandu's is 01:45).
-- ---------------------------------------------------------------------------

create function push_claim_morning_edit()
returns table (user_id uuid, dedupe_key text)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.user_id                                                as uid,
           to_char((now() at time zone p.time_zone)::date, 'YYYY-MM-DD') as local_date
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.morning_edit
       and p.deletion_requested_at is null
       and p.time_zone is not null
       -- Belt and braces: a zone string that predates the validating trigger
       -- would raise inside `at time zone` and take the whole sweep with it.
       and exists (select 1 from pg_catalog.pg_timezone_names z
                    where z.name = p.time_zone)
       and (now() at time zone p.time_zone)::time >= n.morning_edit_at
       and (now() at time zone p.time_zone)::time <  n.morning_edit_at + interval '2 hours'
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'morning_edit', d.local_date from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key from claimed c;
$$;

-- ---------------------------------------------------------------------------
-- 2. Friend activity.
--
--   Promise: "When someone you added adds you back, or adds a piece to their
--   closet." Batched to at most one an hour.
--
--   DEDUPE KEY: the UTC hour the batch COVERS, `2026-08-10T14`. Not the hour it
--   ran in — the window is `[bucket, bucket + 1 hour)` and the sweep runs after
--   the bucket has closed, so the two would differ and the key would drift with
--   the cron's own lateness. Anchoring both to `date_trunc('hour', now()) -
--   1 hour` makes the windows tile the timeline exactly: no gap, no overlap, no
--   event counted into two batches.
--
--   The cost of exact tiling is that a sweep which does not run loses its hour
--   rather than folding it into the next one. That is the right way round.
--   Atlas 37 promises at most one an hour and atlas 32 already promises the
--   fallback in as many words — "requests, borrows and invitations still
--   arrive; they wait for you on Activity". A missed batch costs an
--   interruption, not the information.
--
--   Friendship here is mutual follow plus not-blocked, spelled out rather than
--   borrowed from `is_friend`, which reads `auth.uid()` and so cannot answer a
--   question about somebody else's pair.
-- ---------------------------------------------------------------------------

create function push_claim_friend_activity()
returns table (
  user_id      uuid,
  dedupe_key   text,
  follow_backs integer,
  new_pieces   integer,
  lead_name    text,
  people       integer
)
language sql
security definer
set search_path = ''
as $$
  with win as (
    -- Every boundary pinned to UTC, twice over: `date_trunc` on a timestamptz
    -- truncates in the SESSION's zone, so a connection that had picked up
    -- Asia/Kolkata would tile the day on half-hour boundaries and hand out a
    -- second batch for an hour already sent. The round trip through UTC makes
    -- the window and its key independent of who is connected.
    select (date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC')
             - interval '1 hour'                                        as lo,
           (date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC') as hi
  ),
  bucket as (
    select to_char(w.lo at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as key from win w
  ),
  recipients as (
    select n.user_id as uid
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.friend_activity
       and p.deletion_requested_at is null
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  -- Somebody you added added you back. The row is THEIRS, so its timestamp is
  -- the moment the pair became mutual — which is the news.
  backs as (
    select r.uid, f.follower_id as actor_id,
           coalesce(nullif(btrim(pr.display_name), ''),
                    nullif(pr.username, ''), 'Someone') as actor_name
      from recipients r
      join public.follows f  on f.followee_id = r.uid
      left join public.profiles pr on pr.user_id = f.follower_id, win w
     where f.created_at >= w.lo and f.created_at < w.hi
       and exists (select 1 from public.follows back
                    where back.follower_id = r.uid
                      and back.followee_id = f.follower_id)
       and not public.blocked_between(r.uid, f.follower_id)
  ),
  -- Everyone whose closet is open to this reader, so the item lookup below
  -- rides `items_user_active_idx (user_id, created_at desc) where not archived`
  -- instead of sweeping the whole table once an hour.
  friends as (
    select r.uid, f.followee_id as friend_id
      from recipients r
      join public.follows f on f.follower_id = r.uid
     where exists (select 1 from public.follows back
                    where back.follower_id = f.followee_id
                      and back.followee_id = r.uid)
       and not public.blocked_between(r.uid, f.followee_id)
  ),
  -- ...and a piece added to one of them. The visibility test mirrors the
  -- `friend_items` view (20260808110000): not archived, and the owner has not
  -- hidden their closet. A hidden closet is silent, not merely unreadable.
  pieces as (
    select fr.uid, i.user_id as actor_id,
           coalesce(nullif(btrim(pr.display_name), ''),
                    nullif(pr.username, ''), 'Someone') as actor_name
      from friends fr
      join public.items i on i.user_id = fr.friend_id
      left join public.profiles pr on pr.user_id = i.user_id, win w
     where i.created_at >= w.lo and i.created_at < w.hi
       and not i.is_archived
       -- A photograph still on its way up is not yet a piece in a closet, and
       -- some of them never become one. The cost of this line is that a slow
       -- upload misses its batch entirely, since the window is on `created_at`
       -- and that hour will not come round again. Missing a nudge is cheaper
       -- than announcing a garment that failed to arrive.
       and i.status <> 'pending_upload'
       and exists (select 1 from public.profiles ph
                    where ph.user_id = i.user_id and not ph.closet_hidden)
  ),
  signals as (
    select b.uid, b.actor_id, b.actor_name, true as is_back from backs b
    union all
    select p.uid, p.actor_id, p.actor_name, false           from pieces p
  ),
  due as (
    select s.uid,
           count(*) filter (where s.is_back)::integer     as follow_backs,
           count(*) filter (where not s.is_back)::integer as new_pieces,
           count(distinct s.actor_id)::integer            as people,
           -- One name to lead the sentence. `min` rather than "the most
           -- recent" so a batch that is computed twice reads the same both
           -- times — a notification whose wording depends on when it was
           -- assembled is a notification nobody can reason about.
           min(s.actor_name)                              as lead_name
      from signals s
     group by s.uid
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'friend_activity', (select key from bucket) from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, d.follow_backs, d.new_pieces, d.lead_name, d.people
    from claimed c
    join due d on d.uid = c.user_id;
$$;

-- ---------------------------------------------------------------------------
-- 3. Borrow requests.
--
--   Promise: "When a friend asks for something of yours, and when they return
--   it." Both ends of the loop, or neither.
--
--   DEDUPE KEY: the request's row id, prefixed by which end of the loop it is —
--   `req:<uuid>` and `ret:<uuid>`. Not the row id alone, or the return would
--   collide with the request and the second half of the promise would never be
--   kept. Both ends live under one boolean and one channel, which is what makes
--   "or neither" structural rather than a habit: there is no switch that can
--   turn off the return and leave the request.
--
--   Both messages go to the OWNER. The requester learns of an approval or a
--   refusal in the app, because atlas 37 gives this channel two sentences and
--   neither of them is about being answered; adding a third would be a channel
--   nobody wrote a description for.
--
--   The lookback is an hour against a sweep that runs every five minutes. The
--   overlap is free — the ledger absorbs it — and it means a sweep that missed
--   a run still catches up rather than dropping a request on the floor.
-- ---------------------------------------------------------------------------

create function push_claim_borrow_requests()
returns table (
  user_id    uuid,
  dedupe_key text,
  kind       text,
  actor_name text,
  item_label text
)
language sql
security definer
set search_path = ''
as $$
  with recipients as (
    select n.user_id as uid
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.borrow_requests
       and p.deletion_requested_at is null
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  loop_ends as (
    -- Asked for.
    select r.uid, 'req:' || b.id::text as key, 'requested' as kind,
           b.requester_id as actor_id, b.item_id
      from recipients r
      join public.borrow_requests b on b.owner_id = r.uid
     where b.status = 'pending'
       and b.created_at >= now() - interval '1 hour'
       and not public.blocked_between(r.uid, b.requester_id)

    union all

    -- Given back. `updated_at`, not `created_at`: the news is the return, and
    -- that happened when the status moved. The key is permanent, so a row
    -- touched again later cannot ring a second time.
    select r.uid, 'ret:' || b.id::text, 'returned',
           b.requester_id, b.item_id
      from recipients r
      join public.borrow_requests b on b.owner_id = r.uid
     where b.status = 'returned'
       and b.updated_at >= now() - interval '1 hour'
       and not public.blocked_between(r.uid, b.requester_id)
  ),
  due as (
    select l.uid, l.key, l.kind,
           coalesce(nullif(btrim(pr.display_name), ''),
                    nullif(pr.username, ''), 'A friend')          as actor_name,
           -- `subcategory ?? category`, the same label the app itself prints
           -- (src/app/friends/[userId].tsx, src/features/stylist/intent.ts).
           coalesce(nullif(btrim(i.subcategory), ''),
                    i.category::text, 'a piece')                  as item_label
      from loop_ends l
      left join public.profiles pr on pr.user_id = l.actor_id
      left join public.items    i  on i.id       = l.item_id
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'borrow_requests', d.key from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, d.kind, d.actor_name, d.item_label
    from claimed c
    join due d on d.uid = c.user_id and d.key = c.dedupe_key;
$$;

-- ---------------------------------------------------------------------------
-- 4. Event reminders.
--
--   Promise: "The evening before an event you are going to, once."
--
--   DEDUPE KEY: the event id, bare. Not the id plus a date — the promise is
--   once for the event, not once per attempt, and a bare id means that even if
--   the event is moved and its eve comes round again, the reader is reminded
--   the once. This is the only channel whose key never expires, which is why
--   the fortnight prune at the foot of this file is a fortnight and not a day:
--   see the comment there.
--
--   "Evening" is 18:00–21:00 in the READER's zone, and "going" is
--   `state = 'joined'` — which covers the host too, since creating an event
--   joins you to it (20260807101000). Three hours of eligibility against an
--   hourly sweep means only the first run sends; the other two find the row
--   already booked and do nothing. Cancelled events and events with no date at
--   all (20260808130000 made `starts_at` nullable) are not reminded about,
--   because there is no evening before a day nobody has chosen.
-- ---------------------------------------------------------------------------

create function push_claim_event_reminders()
returns table (
  user_id     uuid,
  dedupe_key  text,
  event_title text
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.user_id as uid, e.id as event_id, e.title
      from public.notification_prefs n
      join public.profiles p       on p.user_id = n.user_id
      join public.event_members mem on mem.user_id = n.user_id and mem.state = 'joined'
      join public.events e          on e.id = mem.event_id
     where n.event_reminders
       and p.deletion_requested_at is null
       and p.time_zone is not null
       and exists (select 1 from pg_catalog.pg_timezone_names z
                    where z.name = p.time_zone)
       and e.canceled_at is null
       and e.starts_at is not null
       and (e.starts_at at time zone p.time_zone)::date
             = ((now() at time zone p.time_zone)::date + 1)
       and (now() at time zone p.time_zone)::time >= time '18:00'
       and (now() at time zone p.time_zone)::time <  time '21:00'
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'event_reminders', d.event_id::text from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, d.title
    from claimed c
    join due d on d.uid = c.user_id and d.event_id::text = c.dedupe_key;
$$;

-- ---------------------------------------------------------------------------
-- 5. Votes and comments.
--
--   Promise: "When friends weigh in on a look you asked about." One message per
--   look per hour, never one per vote.
--
--   DEDUPE KEY: `<post id>:<UTC hour covered>`. Per LOOK, not per person — the
--   whole point of the row is that six friends voting on one plate is one
--   interruption. Two looks voted on in the same hour are two messages, which
--   is what the atlas says and is also the only reading under which the message
--   can name which look it is about.
--
--   Same tiling as friend activity, and the same consequence for a missed run.
--
--   THE BODY CARRIES NO COMMENT TEXT. Only counts cross into a payload. A push
--   notification renders on a locked screen to whoever is holding the phone,
--   and a friend's sentence about your outfit is theirs to show, not ours to
--   put on the glass. Hidden comments are excluded outright — a comment the
--   owner already took down must not arrive as a nudge.
-- ---------------------------------------------------------------------------

create function push_claim_votes_comments()
returns table (
  user_id    uuid,
  dedupe_key text,
  votes      integer,
  comments   integer
)
language sql
security definer
set search_path = ''
as $$
  with win as (
    -- The same UTC-pinned tiling as friend activity; the reasoning is there.
    select (date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC')
             - interval '1 hour'                                        as lo,
           (date_trunc('hour', now() at time zone 'UTC') at time zone 'UTC') as hi
  ),
  bucket as (
    select to_char(w.lo at time zone 'UTC', 'YYYY-MM-DD"T"HH24') as key from win w
  ),
  recipients as (
    select n.user_id as uid
      from public.notification_prefs n
      join public.profiles p on p.user_id = n.user_id
     where n.votes_comments
       and p.deletion_requested_at is null
       and exists (select 1 from public.push_tokens t where t.user_id = n.user_id)
  ),
  mine as (
    select r.uid, po.id as post_id
      from recipients r
      join public.event_outfit_posts po on po.user_id = r.uid
  ),
  weighed as (
    select m.uid, m.post_id, true as is_vote
      from mine m
      join public.event_outfit_votes v on v.post_id = m.post_id, win w
     where v.created_at >= w.lo and v.created_at < w.hi
       and v.voter_id <> m.uid
       and not public.blocked_between(m.uid, v.voter_id)

    union all

    select m.uid, m.post_id, false
      from mine m
      join public.event_comments c on c.post_id = m.post_id, win w
     where c.created_at >= w.lo and c.created_at < w.hi
       and c.user_id <> m.uid
       and not c.hidden
       and not public.blocked_between(m.uid, c.user_id)
  ),
  due as (
    select g.uid,
           g.post_id::text || ':' || (select key from bucket) as key,
           count(*) filter (where g.is_vote)::integer         as votes,
           count(*) filter (where not g.is_vote)::integer     as comments
      from weighed g
     group by g.uid, g.post_id
  ),
  claimed as (
    insert into public.push_sends (user_id, channel, dedupe_key)
    select d.uid, 'votes_comments', d.key from due d
    on conflict do nothing
    returning push_sends.user_id, push_sends.dedupe_key
  )
  select c.user_id, c.dedupe_key, d.votes, d.comments
    from claimed c
    join due d on d.uid = c.user_id and d.key = c.dedupe_key;
$$;

-- ---------------------------------------------------------------------------
-- 6. Releasing a claim that bought nothing.
--
-- Called by `send-push` when the request to Apple failed as a whole — no
-- tickets came back, so nothing was delivered and the booking is for a message
-- that does not exist. Deleting it lets the next sweep try again.
--
-- Deliberately NOT called when individual tickets fail. A ticket that came back
-- with an error is a message Expo accepted and then could not place; retrying
-- it is how a reader ends up with two morning edits, and the whole table exists
-- to prevent that. Between "very occasionally lost" and "occasionally doubled",
-- this channel picks lost, every time.
-- ---------------------------------------------------------------------------

create function push_release_claims(p_channel text, p_user_ids uuid[], p_keys text[])
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.push_sends s
     using unnest(p_user_ids, p_keys) as u(uid, key)
     where s.channel    = p_channel
       and s.user_id    = u.uid
       and s.dedupe_key = u.key
       -- Only ever a claim this sweep just made. Without the age bound, a
       -- caller with a stale list could unbook a send from last week and cause
       -- the duplicate this table exists to prevent.
       and s.sent_at >= now() - interval '15 minutes'
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- ---------------------------------------------------------------------------
-- 7. The prune.
--
-- A fortnight, because that is the longest any key needs to be remembered to
-- keep a promise: the hourly buckets are stale in an hour and the local date in
-- a day, but an event reminder's key is the event id and has to outlive the
-- eve it fired on. Fourteen days covers an event postponed by a week and
-- reminded about once, which is the promise. Beyond that the row is only
-- history, and this table is bookkeeping rather than history.
-- ---------------------------------------------------------------------------

create function push_sends_prune()
returns integer
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.push_sends where sent_at < now() - interval '14 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

-- ---------------------------------------------------------------------------
-- Reachability. None of this is client-callable, in any role, ever.
--
-- Default privileges grant EXECUTE to PUBLIC, so the revoke is the load-bearing
-- line and the grants are the whole guest list. `service_role` is the edge
-- function; `postgres` is pg_cron's job runner.
-- ---------------------------------------------------------------------------

revoke execute on function push_claim_morning_edit()    from public, anon, authenticated;
revoke execute on function push_claim_friend_activity() from public, anon, authenticated;
revoke execute on function push_claim_borrow_requests() from public, anon, authenticated;
revoke execute on function push_claim_event_reminders() from public, anon, authenticated;
revoke execute on function push_claim_votes_comments()  from public, anon, authenticated;
revoke execute on function push_release_claims(text, uuid[], text[])
                                                        from public, anon, authenticated;
revoke execute on function push_sends_prune()           from public, anon, authenticated;

grant execute on function push_claim_morning_edit()    to service_role, postgres;
grant execute on function push_claim_friend_activity() to service_role, postgres;
grant execute on function push_claim_borrow_requests() to service_role, postgres;
grant execute on function push_claim_event_reminders() to service_role, postgres;
grant execute on function push_claim_votes_comments()  to service_role, postgres;
grant execute on function push_release_claims(text, uuid[], text[]) to service_role, postgres;
grant execute on function push_sends_prune()           to service_role, postgres;
