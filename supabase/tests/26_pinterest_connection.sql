-- The Pinterest connection boundary.
--
-- What is under proof: the owner can see THAT they are connected and nothing
-- more; nobody else can see anything at all; the token columns are unreadable
-- from every client role; no client role can write either table; the OAuth
-- state is single-use and expiring by construction of its consume predicate;
-- and deleting the auth user removes every connection artifact.
--
-- The consume predicate is tested here AS SQL — the same statement the Edge
-- Function runs — because single-use is a property of that statement's
-- atomicity, not of any code around it.

begin;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','pin-owner@example.test','',now(),now(),now()),
       ('aaaaaaaa-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000',
        'authenticated','authenticated','pin-other@example.test','',now(),now(),now())
on conflict (id) do nothing;

-- Seed as the service role (the only legitimate writer).
insert into public.pinterest_connections
  (user_id, access_token_enc, refresh_token_enc, access_expires_at, scopes)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'enc:access', 'enc:refresh',
        now() + interval '30 days', array['boards:read','pins:read']);

insert into public.pinterest_oauth_states (state, user_id, expires_at)
values ('state-live',     'aaaaaaaa-0000-0000-0000-000000000001', now() + interval '10 minutes'),
       ('state-expired',  'aaaaaaaa-0000-0000-0000-000000000001', now() - interval '1 minute'),
       ('state-consumed', 'aaaaaaaa-0000-0000-0000-000000000001', now() + interval '10 minutes');
update public.pinterest_oauth_states set consumed_at = now() where state = 'state-consumed';

-- ── 1. The owner sees the fact of the connection, not its material ─────────
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select results_eq(
  $$ select status from public.pinterest_connections $$,
  $$ values ('connected') $$,
  'the owner reads their own connection status'
);

select throws_like(
  $$ select access_token_enc from public.pinterest_connections $$,
  '%permission denied%',
  'the access token column is unreadable even by the owner'
);
select throws_like(
  $$ select refresh_token_enc from public.pinterest_connections $$,
  '%permission denied%',
  'the refresh token column is unreadable even by the owner'
);

-- ── 2. The owner cannot write ──────────────────────────────────────────────
select throws_like(
  $$ insert into public.pinterest_connections (user_id, access_token_enc, access_expires_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'forged', now()) $$,
  '%permission denied%',
  'no client can insert a connection'
);
select throws_like(
  $$ update public.pinterest_connections set status = 'revoked' $$,
  '%permission denied%',
  'no client can update a connection'
);
select throws_like(
  $$ delete from public.pinterest_connections $$,
  '%permission denied%',
  'no client can delete a connection — disconnect goes through the function'
);

-- ── 3. OAuth states are invisible to every client ──────────────────────────
select throws_like(
  $$ select state from public.pinterest_oauth_states $$,
  '%permission denied%',
  'the owner cannot read oauth states'
);

-- ── 4. An unrelated user sees nothing ──────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is_empty(
  $$ select user_id from public.pinterest_connections $$,
  'an unrelated user sees no connection rows'
);

-- ── 5. Anon sees nothing ───────────────────────────────────────────────────
set local role anon;
select set_config('request.jwt.claims', '', true);
select throws_like(
  $$ select user_id from public.pinterest_connections $$,
  '%permission denied%',
  'anon cannot read connections at all'
);

reset role;

-- ── 6. The consume predicate: single-use and expiring by construction ──────
-- The exact statement pinterest-oauth's callback runs, three ways.

create temp table consumed (attempt text, got uuid);

insert into consumed
select 'live', user_id from (
  update public.pinterest_oauth_states
     set consumed_at = now()
   where state = 'state-live' and consumed_at is null and expires_at > now()
   returning user_id
) r;
select is(
  (select got from consumed where attempt = 'live'),
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'a live state consumes exactly once and yields its user'
);

insert into consumed
select 'replay', user_id from (
  update public.pinterest_oauth_states
     set consumed_at = now()
   where state = 'state-live' and consumed_at is null and expires_at > now()
   returning user_id
) r;
select is_empty(
  $$ select got from consumed where attempt = 'replay' $$,
  'replaying the same state consumes nothing'
);

insert into consumed
select 'expired', user_id from (
  update public.pinterest_oauth_states
     set consumed_at = now()
   where state = 'state-expired' and consumed_at is null and expires_at > now()
   returning user_id
) r;
select is_empty(
  $$ select got from consumed where attempt = 'expired' $$,
  'an expired state consumes nothing'
);

insert into consumed
select 'pre-consumed', user_id from (
  update public.pinterest_oauth_states
     set consumed_at = now()
   where state = 'state-consumed' and consumed_at is null and expires_at > now()
   returning user_id
) r;
select is_empty(
  $$ select got from consumed where attempt = 'pre-consumed' $$,
  'a previously consumed state consumes nothing'
);

-- ── 7. Account deletion removes every artifact ─────────────────────────────
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is_empty(
  $$ select user_id from public.pinterest_connections
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'deleting the auth user removes the connection'
);
select is_empty(
  $$ select state from public.pinterest_oauth_states
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'deleting the auth user removes every oauth state'
);

select * from finish();
rollback;
