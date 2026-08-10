-- ===========================================================================
-- Push — the tokens, and the promises.
--
-- Atlas 37's governing rule is that "the description is the promise": if a row
-- says once a day, the sender enforces once a day. That rule is only keepable
-- if the schedule lives beside the switch, so the preference row and the
-- sender's bookkeeping are the same table.
--
-- NOTHING IN THIS MIGRATION MAKES A NOTIFICATION ARRIVE. `expo-notifications`
-- is not in the binary and the entitlement is not on the app, so until a store
-- build is cut no device can register a token and this table stays empty. That
-- is the intended state: the client keys off `PUSH_AVAILABLE` and hides the
-- Notifications row entirely, so the OTA that carries this schema ships
-- nothing dead. See docs/design/diary-boards-activity-contract.md §6.
--
-- One channel from the atlas is deliberately absent: **Season in review**.
-- Atlas 34 is deferred (§3), and a switch for a feature that does not exist is
-- the same refusal as the Notifications row in system-safety-contract.md §4.2.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Device tokens.
--
-- One row per install, not per user: a person with a phone and an iPad gets
-- two, and both should ring. The unique key is the token, so a device that
-- reinstalls and is issued the same token updates rather than duplicating.
-- ---------------------------------------------------------------------------

create table push_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token        text not null unique check (char_length(token) between 8 and 256),
  platform     text not null default 'ios' check (platform in ('ios', 'android')),
  created_at   timestamptz not null default now(),
  -- Refreshed on every launch that registers. A token nothing has touched in
  -- months is a device that is gone, and sending to it earns a rejection from
  -- APNs rather than a delivery.
  last_seen_at timestamptz not null default now()
);

create index push_tokens_user_idx on push_tokens using btree (user_id);

alter table push_tokens enable row level security;

create policy "push_tokens: owner can select" on push_tokens
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "push_tokens: owner can insert" on push_tokens
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "push_tokens: owner can update" on push_tokens
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "push_tokens: owner can delete" on push_tokens
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table push_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The channels.
--
-- One boolean per row on NP-01, in the atlas's own two groups. Defaults follow
-- its rule exactly: "on by default, except votes. A new account gets the
-- morning edit, friendship, borrows and events. Anything that fires per friend
-- action starts off."
--
-- Votes is the one that starts false because it is the only channel whose
-- frequency is set by other people.
-- ---------------------------------------------------------------------------

create table notification_prefs (
  user_id         uuid primary key references auth.users (id) on delete cascade,

  morning_edit    boolean not null default true,
  -- NP-04's four slots and no free picker. A `time` rather than an integer so
  -- it reads as what it is, and constrained to the four the design offers —
  -- an arbitrary time would be a schedule nobody wrote a sender for.
  morning_edit_at time    not null default '07:30'
                  check (morning_edit_at in ('06:30', '07:00', '07:30', '08:00')),

  friend_activity boolean not null default true,
  borrow_requests boolean not null default true,
  event_reminders boolean not null default true,

  votes_comments  boolean not null default false,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table notification_prefs enable row level security;

create trigger notification_prefs_set_updated_at
  before update on notification_prefs for each row execute function set_updated_at();

create policy "notification_prefs: owner can select" on notification_prefs
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "notification_prefs: owner can insert" on notification_prefs
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "notification_prefs: owner can update" on notification_prefs
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "notification_prefs: owner can delete" on notification_prefs
  for delete to authenticated using ((select auth.uid()) = user_id);

grant select, insert, update, delete on table notification_prefs to authenticated;

-- ---------------------------------------------------------------------------
-- 3. The sender's ledger.
--
-- The only way "never more than one a day" and "batched to at most one an
-- hour" can be true is if the sender can prove what it already sent. Every
-- send writes here first; the uniqueness constraint is the enforcement, not a
-- convention the sender is trusted to follow.
--
-- `dedupe_key` is composed by the sender per channel — the local date for the
-- morning edit, the hour bucket for a batch, the row id for a borrow. A second
-- attempt at the same key is a no-op insert, which is exactly what a retry
-- after a partial failure should be.
-- ---------------------------------------------------------------------------

create table push_sends (
  user_id    uuid not null references auth.users (id) on delete cascade,
  channel    text not null check (channel in (
    'morning_edit', 'friend_activity', 'borrow_requests',
    'event_reminders', 'votes_comments'
  )),
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 128),
  sent_at    timestamptz not null default now(),
  primary key (user_id, channel, dedupe_key)
);

-- The sweep that clears anything older than a fortnight, and the per-channel
-- "when did I last send" read.
create index push_sends_recent_idx on push_sends (channel, sent_at desc);

alter table push_sends enable row level security;

-- No client policy of any kind. This table is written by the sender running as
-- the service role and read by nobody else: it is bookkeeping, not content,
-- and a client that could read it would learn when other people were messaged.
-- RLS on with zero policies is the closed state, and the explicit revoke says
-- so out loud rather than relying on the absence of a grant.
revoke all on table push_sends from anon, authenticated;
