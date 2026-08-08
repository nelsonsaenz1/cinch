-- ===========================================================================
-- Guideline 1.2 — "a method for filtering objectionable content".
--
-- WHERE THIS RUNS, AND WHY IT IS NOT AN EDGE FUNCTION.
--
-- docs/social/product-spec.md §7.4.5 specified this as "server-side, in the
-- Edge Function path". There is no Edge Function in that path: every social
-- write is a direct client -> PostgREST insert (see src/features/events,
-- event-outfits, social-graph). Routing six write paths through a new function
-- would mean rewriting every mutation hook, and would leave the raw table
-- grants in place behind it — so the filter would be advisory, not enforced.
--
-- A BEFORE trigger is strictly better here. It is unbypassable (the client
-- cannot reach the table without going through it), atomic with the write, and
-- costs the client nothing. The denylist lives in a table rather than in this
-- file so the operator can extend it with an UPDATE rather than a release —
-- same argument as ai_config (20260803180000).
--
-- WHAT IT DELIBERATELY DOES NOT DO.
--
-- Rejections are not logged. A trigger that raises rolls back its own audit
-- insert, and Postgres has no autonomous transaction to escape that. Durable
-- "who keeps trying" telemetry needs a different mechanism; repeat-offender
-- handling today is content_reports plus the auto-hide trigger in
-- 20260807102000. Better to leave the gap visible than to write a log that
-- silently never receives a row.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The list. Service-role only: a client-readable denylist is a bypass manual.
-- ---------------------------------------------------------------------------
create table moderation_terms (
  term         text primary key check (char_length(term) between 2 and 64),
  -- Match the de-punctuated variant too ("f u c k", "f.u.c.k"). Off by default
  -- because squeezing text collides across word boundaries: with this on, a
  -- short term will eventually fire inside an innocent phrase. Reserve it for
  -- terms long and distinctive enough that a collision is not credible.
  match_squeezed boolean not null default false,
  note         text,
  created_at   timestamptz not null default now(),
  constraint moderation_terms_lowercase check (term = lower(term)),
  -- Squeezed matching has no word boundary to protect it, so hold it to a
  -- length where an accidental substring hit stops being plausible.
  constraint moderation_terms_squeezed_is_long
    check (not match_squeezed or char_length(term) >= 5)
);
alter table moderation_terms enable row level security;
-- No policies at all: authenticated and anon get nothing. service_role bypasses
-- RLS, which is the only access this table is meant to have.

-- ---------------------------------------------------------------------------
-- Normalisation. Defeats the three evasions that cost nothing to defeat:
-- case, leetspeak, and held-down keys. Everything here is character-level and
-- immutable, so it can be indexed later if the list ever gets long enough to
-- matter (it will not; this runs over one short string per write).
-- ---------------------------------------------------------------------------
create function normalize_for_moderation(p_text text) returns text
language sql immutable strict set search_path = '' as $$
  select regexp_replace(
           -- 3+ of the same character collapse to one: "fuuuuck" -> "fuck".
           -- Threshold is 3 rather than 2 so ordinary doubles ("pass",
           -- "getting", "sees") survive untouched.
           regexp_replace(
             translate(lower(p_text), '0134578@$!|', 'oieastbasii'),
             '(.)\1{2,}', '\1', 'g'),
           -- Runs of separators become one space, so word boundaries survive
           -- "hey---there" and "hey, there" alike.
           '[^a-z0-9]+', ' ', 'g');
$$;

-- The de-punctuated variant: every non-alphanumeric removed, so "f u c k" and
-- "f.u.c.k" both become "fuck". Only consulted for terms that opted in.
create function squeeze_for_moderation(p_text text) returns text
language sql immutable strict set search_path = '' as $$
  select regexp_replace(public.normalize_for_moderation(p_text), '[^a-z0-9]', '', 'g');
$$;

-- ---------------------------------------------------------------------------
-- The check. Returns the offending term, or null when the text is clean —
-- returning the term rather than a boolean is what lets the operator see which
-- entry fired without re-deriving it.
--
-- SECURITY DEFINER because the caller must not be able to read the list; the
-- trigger below is deliberately INVOKER so that current_user still identifies
-- the client role.
-- ---------------------------------------------------------------------------
create function blocked_term_in(p_text text) returns text
language sql stable security definer set search_path = '' as $$
  select t.term
    from public.moderation_terms t
   where p_text is not null
     and (
       -- \m and \M are Postgres word boundaries: "assassin" and "Scunthorpe"
       -- do not match a term that happens to sit inside them.
       public.normalize_for_moderation(p_text) ~ ('\m' || t.term || '\M')
       or (t.match_squeezed
           and public.squeeze_for_moderation(p_text) like '%' || t.term || '%')
     )
   limit 1;
$$;

revoke execute on function normalize_for_moderation(text) from public, anon, authenticated;
revoke execute on function squeeze_for_moderation(text)   from public, anon, authenticated;
revoke execute on function blocked_term_in(text)          from public, anon, authenticated;
-- The trigger runs as the caller, so the caller needs EXECUTE on the check.
-- This does leak the list to anyone patient enough to binary-search it one
-- rejected post at a time — which is equally true of any filter that tells the
-- user their text was refused, and is the cost of telling them at all.
grant execute on function blocked_term_in(text) to authenticated;

-- ---------------------------------------------------------------------------
-- One trigger function for every surface. The columns to inspect arrive as
-- trigger arguments, so adding a surface is a CREATE TRIGGER and nothing else.
--
-- SECURITY INVOKER on purpose: a DEFINER function would report current_user as
-- the owner and the service-role escape below would never fire.
-- ---------------------------------------------------------------------------
create function assert_clean_ugc() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  v_col       text;
  v_value     text;
  v_unchanged boolean;
  v_hit       text;
begin
  -- Guard client writes only. Backfills, service_role repairs, and the
  -- signup-time profile insert from handle_new_user() all run as another role
  -- and must not be able to fail on a display name Apple handed us.
  if current_user <> 'authenticated' then
    return new;
  end if;

  foreach v_col in array tg_argv loop
    execute format('select ($1).%I::text', v_col) into v_value using new;
    continue when v_value is null;

    -- On UPDATE, only inspect columns that actually changed. Without this the
    -- filter eats its own moderation: the denylist grows, an already-stored
    -- comment now matches it, and the host trying to set `hidden = true` is
    -- refused because the trigger re-checks a body they never touched. The
    -- text was accepted under the list in force when it was written; a later
    -- list is grounds for hiding it, not for freezing the row.
    if tg_op = 'UPDATE' then
      execute format('select ($1).%I::text is not distinct from ($2).%I::text', v_col, v_col)
        into v_unchanged using new, old;
      continue when v_unchanged;
    end if;

    v_hit := public.blocked_term_in(v_value);
    if v_hit is not null then
      -- 23514 (check_violation): the client maps this to a plain sentence.
      -- The matched term is deliberately absent from the message — naming it
      -- turns every rejection into a free lookup against the list.
      raise exception 'that wording is not allowed here'
        using errcode = '23514',
              detail  = format('%s.%s', tg_table_name, v_col);
    end if;
  end loop;

  return new;
end; $$;
revoke execute on function assert_clean_ugc() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The surfaces. Every free-text column a client can write and another user can
-- read. Votes are excluded because a vote carries no text.
-- ---------------------------------------------------------------------------
create trigger event_comments_clean_text
  before insert or update on event_comments
  for each row execute function assert_clean_ugc('body');

create trigger event_outfit_posts_clean_text
  before insert or update on event_outfit_posts
  for each row execute function assert_clean_ugc('caption');

create trigger events_clean_text
  before insert or update on events
  for each row execute function assert_clean_ugc('title', 'note', 'dress_code');

create trigger borrow_requests_clean_text
  before insert or update on borrow_requests
  for each row execute function assert_clean_ugc('message');

-- Profiles carry the name every other surface renders, so a slur here is worse
-- than one in a comment: it appears next to everyone else's content.
create trigger profiles_clean_text
  before insert or update on profiles
  for each row execute function assert_clean_ugc('display_name', 'username', 'bio');

-- ---------------------------------------------------------------------------
-- Seed.
--
-- A starter set only, and deliberately confined to common profanity: a slur
-- list does not belong in version control, hand-typed by whoever wrote the
-- migration. Load a maintained list (LDNOOBW's `List-of-Dirty-Naughty-...`, or
-- a commercial feed) as service_role before launch:
--
--   insert into moderation_terms (term, match_squeezed, note)
--   select lower(t), char_length(t) >= 5, 'ldnoobw en'
--     from unnest($1::text[]) as t
--   on conflict (term) do nothing;
--
-- The list is the operator's ongoing responsibility, not a one-time migration.
-- ---------------------------------------------------------------------------
-- On match_squeezed, which is off for most of these and worth explaining:
--
--   'cunt'  — four letters, so the length constraint forbids it anyway, and
--             for good reason: squeezed matching would fire on "Scunthorpe".
--   'whore' — long enough to qualify, still false. Stripping punctuation turns
--             "who're" into "whore", and "the friends who're coming" is a
--             sentence someone will actually type.
--   'fuck'  — four letters. Word-boundary matching still catches the ordinary
--             spellings and the leetspeak; only the spaced-out form gets
--             through, which is the trade the constraint is making.
insert into moderation_terms (term, match_squeezed, note) values
  ('fuck',    false, 'starter set'),
  ('shit',    false, 'starter set'),
  ('bitch',   true,  'starter set'),
  ('cunt',    false, 'starter set — squeezed would hit Scunthorpe'),
  ('asshole', true,  'starter set'),
  ('whore',   false, 'starter set — squeezed would hit "who''re"'),
  ('slut',    false, 'starter set')
on conflict (term) do nothing;

-- No client grants on moderation_terms. Intentional, and the point.
