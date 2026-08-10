-- The Walkthrough, part one of three: one row per spoken closet.
--
-- Spec: docs/design/voice-intake-directive.md §5.1.
--
-- WHY THIS TABLE EXISTS AT ALL
--
-- A procession is twenty-odd cards long and runs for minutes. iOS will kill a
-- backgrounded app mid-flow, and a user who loses forty spoken garments to a
-- phone call does not speak them again. This row is what a cold start resumes
-- from: `cursor` is the index into intake_drafts the procession was on, and
-- `status` is what tells the client which screen to reopen at.
--
-- `transcript` is kept on the session rather than thrown away after parsing
-- because it is the evidence behind every receipt line — V-13's "nothing
-- parsed" branch shows the full transcript, which is only possible if it
-- survives the parse. See §8 for how long it is allowed to live.

create table public.intake_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,

  status        text not null default 'recording'
                  check (status in ('recording','transcribing','parsing','reviewing',
                                    'committed','abandoned','failed')),

  transcript    text,
  duration_ms   integer check (duration_ms is null or duration_ms >= 0),

  -- Index into this session's drafts, by ordinal. Not a foreign key: the
  -- procession sits *between* cards as often as on one, and a cursor equal to
  -- the draft count is the legitimate "finished, awaiting commit" position.
  cursor        integer not null default 0 check (cursor >= 0),

  error_code    text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.intake_sessions is
  'One walkthrough. Exists so a procession survives a cold start — see docs/design/voice-intake-directive.md §5.1.';
comment on column public.intake_sessions.cursor is
  'Index into intake_drafts.ordinal for resume. May equal the draft count, meaning every card is done and the session is awaiting commit.';
comment on column public.intake_sessions.transcript is
  'The evidence behind every receipt line. V-13 shows this in full when the parse finds nothing, so it must outlive the parse.';

create index intake_sessions_user_idx
  on public.intake_sessions (user_id, created_at desc);

-- The client asks "do I have a walkthrough to resume?" on cold start. That is
-- a lookup by user over the three live states and nothing else, so the index
-- is partial — committed and abandoned sessions are history, never resumed.
create index intake_sessions_resumable_idx
  on public.intake_sessions (user_id)
  where status in ('recording','transcribing','parsing','reviewing');

-- ---------------------------------------------------------------------------
-- RLS. Owner-only, all four verbs.
--
-- "RLS is the whole authz model — there is no server-side authorization layer
-- to fall back on" (§5.2). A policy that leaks still typechecks, still bundles
-- and still ships, which is why supabase/tests/10_intake_boundary.sql exercises
-- anon, the owner, an unrelated authenticated user and service_role against
-- every one of these.
-- ---------------------------------------------------------------------------

alter table public.intake_sessions enable row level security;

-- Required, not decorative. Since 20260806101000 a new table in `public` is
-- born with grants for service_role and NOTHING for the client roles — "every
-- authenticated grant is a deliberate line in a migration from now on". Without
-- this the policies below never even get consulted: the client takes a bare
-- 42501 on every read. anon is granted nothing, deliberately.
grant select, insert, update, delete on public.intake_sessions to authenticated;

create policy intake_sessions_select_own
  on public.intake_sessions for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy intake_sessions_insert_own
  on public.intake_sessions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

-- `using` and `with check` both, or an owner could update a row into someone
-- else's name — the check clause is what stops the user_id itself moving.
create policy intake_sessions_update_own
  on public.intake_sessions for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Deletable because abandoning a walkthrough should leave nothing behind, and
-- because §8 requires a user to be able to remove a transcript of their own
-- voice. The cascade to intake_drafts is what makes that complete.
create policy intake_sessions_delete_own
  on public.intake_sessions for delete
  to authenticated
  using (user_id = (select auth.uid()));

create trigger intake_sessions_set_updated_at
  before update on public.intake_sessions
  for each row execute function public.set_updated_at();
