-- ===========================================================================
-- Pinterest connection: the smallest additive schema for one OAuth link.
--
-- Two tables, both owner-cascaded from auth.users, both narrow on purpose.
-- What is deliberately NOT here matters as much as what is: no board rows, no
-- pin rows, no cached API content of any kind. Pinterest's Developer
-- Guidelines generally prohibit storing API data, so boards and pins are
-- fetched live per request by the `pinterest-api` Edge Function and never
-- land in a table. The connection record holds only what Cinch itself owns —
-- the fact of the link and the encrypted credentials that keep it alive.
--
--   pinterest_connections     One row per user. Token material is encrypted
--                             by the Edge Function (AES-256-GCM, key held in
--                             function secrets) before it arrives here, so a
--                             database read alone never yields a usable
--                             token. The client may see THAT a connection
--                             exists and its status — never the token
--                             columns; the column-level grant below is the
--                             fence.
--
--   pinterest_oauth_states    One row per OAuth attempt. Random, expiring,
--                             user-bound, single-use; the callback consumes
--                             a row atomically (update ... where consumed_at
--                             is null returning user_id), which is what makes
--                             replaying a captured redirect a no-op. No
--                             client access at all: RLS is on and no policy
--                             exists, so only the service role touches it.
--
-- Deletion: both tables cascade from auth.users, so delete-account's cascade
-- covers every connection artifact without this migration touching that
-- function. Disconnect-without-deletion goes through the Edge Function, which
-- is the only holder of delete rights on the connection row.
-- ===========================================================================

create table public.pinterest_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,

  -- AES-256-GCM ciphertext, base64: iv.tag.body. Encrypted and decrypted
  -- ONLY inside Edge Functions; the key never exists in the database.
  access_token_enc text not null,
  refresh_token_enc text,

  -- Lifetimes as Pinterest reported them, so refresh can be scheduled and an
  -- expired-but-refreshable connection distinguished from a dead one.
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,

  -- The scopes actually granted — which can be fewer than requested.
  scopes text[] not null default '{}',

  -- 'connected' | 'expired' | 'revoked'. Text rather than an enum, the
  -- style_tags idiom: the writers are two Edge Functions, the reader grades
  -- copy, and an unknown value should load rather than refuse the row.
  status text not null default 'connected',

  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pinterest_connections enable row level security;

-- The owner may see their own row...
create policy "pinterest_connections_owner_select"
  on public.pinterest_connections
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- ...but only the columns that describe the connection, never the ones that
-- ARE the connection. Column-level privileges are the fence: RLS decides
-- which rows, this decides which columns, and the token columns are in
-- neither grant. No insert/update/delete policy exists, so writes are the
-- service role's alone (the OAuth callback and disconnect paths).
revoke select on public.pinterest_connections from authenticated;
grant select (user_id, status, scopes, connected_at, updated_at)
  on public.pinterest_connections
  to authenticated;

create table public.pinterest_oauth_states (
  -- The state parameter itself: 32 random bytes, base64url, minted by the
  -- Edge Function. Primary key so a duplicate mint is impossible.
  state text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Set exactly once by the callback; the atomic consume predicate.
  consumed_at timestamptz
);

-- RLS on, no policies: the service role bypasses RLS, everyone else —
-- including the row's own user — has no path to this table. There is nothing
-- a client could legitimately do with an OAuth state.
alter table public.pinterest_oauth_states enable row level security;
revoke all on public.pinterest_oauth_states from authenticated, anon;

-- The callback's housekeeping index: expired and consumed states are swept
-- opportunistically on each /start, and the sweep should not seq-scan.
create index pinterest_oauth_states_expiry on public.pinterest_oauth_states (expires_at);
