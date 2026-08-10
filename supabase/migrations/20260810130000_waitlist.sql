-- The launch waitlist — one address, captured from a public web form.
--
-- WHY THIS IS THE MOST EXPOSED TABLE IN THE SCHEMA
-- -----------------------------------------------
-- Everything else that writes here is behind a session. This is not: the form
-- at cinchstyle.com/ is served to strangers, the site runs with `script-src`
-- absent so there is no client SDK and no captcha, and the only credential the
-- web function holds is the publishable key. So the whole security model has
-- to live in the shape of the schema rather than in who is calling.
--
-- The shape, in one line: `anon` is granted exactly one function, that function
-- returns a status word and never a row, and the table itself is unreachable
-- from `anon` and `authenticated` by both RLS and grants.
--
-- Ground rules held (20260807100000 §0): no `to anon` policy on a base table,
-- explicit grants only, definer functions with `set search_path = ''`, and no
-- `security_invoker = true` view anywhere near this.

-- ---------------------------------------------------------------------------
-- The list
-- ---------------------------------------------------------------------------

create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  -- Stored lowercased and trimmed. The check is not decoration: this column is
  -- written from an unauthenticated form, and a constraint is the only
  -- validation that survives someone calling the function directly rather than
  -- going through api/waitlist.js.
  email       text not null
                check (email = lower(email))
                check (length(email) between 6 and 254)
                check (email ~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'),
  -- Where the address came in from, so a second capture point later is
  -- distinguishable without a second table. Bounded on purpose — a free-text
  -- column fed by a public endpoint is a place to stuff things.
  source      text not null default 'web'
                check (source in ('web', 'invite', 'support')),
  created_at  timestamptz not null default now(),
  -- Set by whatever eventually sends the launch note. Null means never mailed,
  -- which is every row today: nothing in this project is wired to send to this
  -- list yet. See the report accompanying this migration.
  notified_at timestamptz
);

comment on table public.waitlist is
  'Launch waitlist. Written only by join_waitlist(); readable only by the service role.';

comment on column public.waitlist.notified_at is
  'When the launch note was sent. Null for every row until a sender exists.';

-- One address, one row. Doubles as the abuse floor: re-submitting an address
-- that is already on the list costs the attacker a request and gains nothing.
create unique index waitlist_email_key on public.waitlist (email);

create index waitlist_created_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- No policies at all. `enable row level security` with none defined is a
-- deny-all for every role that goes through RLS; the service role bypasses it,
-- which is how the operator reads the list. The revoke is belt and braces
-- against a schema-wide grant wandering in later: even a mistakenly added
-- policy would then still not be enough to read a single address.
revoke all on table public.waitlist from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The throttle
-- ---------------------------------------------------------------------------

-- Same shape as support_sends (20260810120200): a ledger the client cannot
-- see, because a client that could read its own counter could plan around it.
--
-- WHAT `client_hash` IS. api/waitlist.js hashes the caller's IP with a
-- server-side secret (`WAITLIST_SALT`) and sends the digest. The raw address
-- never reaches Postgres and is never logged. Without the salt the digest is
-- not reversible by enumerating the v4 space, which is the whole reason the
-- salt is mandatory rather than optional in the function above.
create table public.waitlist_throttle (
  client_hash  text primary key check (client_hash ~ '^[0-9a-f]{64}$'),
  window_start timestamptz not null default now(),
  hits         integer not null default 0 check (hits >= 0)
);

comment on table public.waitlist_throttle is
  'Rate-limit ledger for the public waitlist form. Holds a salted IP digest and a counter, nothing else.';

create index waitlist_throttle_window_idx on public.waitlist_throttle (window_start);

alter table public.waitlist_throttle enable row level security;

revoke all on table public.waitlist_throttle from anon, authenticated;

-- ---------------------------------------------------------------------------
-- The one grant
-- ---------------------------------------------------------------------------

/**
 * join_waitlist — the only way a row is created, and the only thing `anon`
 * can do in this feature.
 *
 * RETURNS A WORD, NEVER A ROW. 'ok' | 'throttled' | 'invalid'. An anonymous
 * caller learns whether their own request was accepted and nothing else — in
 * particular 'ok' is returned whether the address was new or already present,
 * so the endpoint cannot be turned into "is this person on the list?".
 *
 * DEFINER, and the usual reason: there is no insert policy to satisfy and
 * there deliberately never will be. Nothing is taken from the caller's
 * identity here — there is no identity — so the definer risk is the narrow
 * one of the function's own body, which touches two tables and writes one
 * validated column.
 *
 * THE THROTTLE. Five accepted or rejected attempts an hour per salted client
 * digest. Counted from the attempt rather than from success, so hammering the
 * endpoint with malformed addresses burns the same budget as real signups. A
 * null digest is a misconfigured caller, not a lucky one: it is refused.
 *
 * The rolling window is a reset-on-read rather than a timestamp sweep, which
 * keeps the table one row per source and means an idle digest costs nothing to
 * carry. Rows nobody has touched in a week are dropped on the way past.
 */
create function public.join_waitlist(
  p_email       text,
  p_client_hash text,
  p_source      text default 'web'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email  text := lower(btrim(coalesce(p_email, '')));
  v_source text := coalesce(nullif(p_source, ''), 'web');
  v_hits   integer;
begin
  -- A caller with no digest cannot be rate limited, and an unthrottled public
  -- writer is not something this schema is willing to be. Refused as invalid
  -- rather than accepted quietly, so a misconfigured deployment shows up as a
  -- dead form instead of an open one.
  if p_client_hash is null or p_client_hash !~ '^[0-9a-f]{64}$' then
    return 'invalid';
  end if;

  if v_source not in ('web', 'invite', 'support') then
    v_source := 'web';
  end if;

  -- Opportunistic sweep. The table is small by construction and this runs on
  -- an indexed column, so it is cheaper than a cron job to forget about.
  delete from public.waitlist_throttle
   where window_start < now() - interval '7 days';

  -- Aliased so the DO UPDATE arm can name the *existing* row unambiguously:
  -- `t.window_start` is what is already stored, `excluded` would be what we
  -- just tried to insert. Getting that backwards would reset the window on
  -- every attempt and quietly disable the limit.
  insert into public.waitlist_throttle as t (client_hash, window_start, hits)
  values (p_client_hash, now(), 1)
  on conflict (client_hash) do update
    set window_start = case
          when t.window_start < now() - interval '1 hour' then now()
          else t.window_start
        end,
        hits = case
          when t.window_start < now() - interval '1 hour' then 1
          else t.hits + 1
        end
  returning t.hits into v_hits;

  if v_hits > 5 then
    return 'throttled';
  end if;

  -- Second line of defence behind api/waitlist.js. The table's own checks
  -- would raise on a bad address; returning a word instead keeps a malformed
  -- submission from surfacing as a 500 on a marketing page.
  if length(v_email) < 6
     or length(v_email) > 254
     or v_email !~ '^[^@[:space:]]+@[^@[:space:].]+(\.[^@[:space:].]+)+$'
  then
    return 'invalid';
  end if;

  insert into public.waitlist (email, source)
  values (v_email, v_source)
  on conflict (email) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
