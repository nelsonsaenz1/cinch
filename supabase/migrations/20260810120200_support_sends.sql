-- Write to us (HS-04, HS-05) — the throttle, and nothing else.
--
-- Atlas 40's rule is "mail, not a ticket system: no tiers, no ticket numbers,
-- no bot", so the message itself is NOT stored here. It goes to the inbox and
-- lives in the inbox, which is the whole point of promising a person reads it.
-- What this table holds is the one thing the mail path cannot do without: a
-- record that a send happened, so an outbound endpoint attached to a mailbox
-- cannot be turned into a way to flood it.
--
-- Same shape as push_sends (20260810100300): RLS on with zero policies, so
-- nothing but the service role inside the edge function can see or write it.
-- A user has no business reading their own throttle counter, and a client that
-- could read it could plan around it.
create table public.support_sends (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  topic   text not null
);

comment on table public.support_sends is
  'Rate-limit ledger for the in-app contact form. Never holds message bodies — those live in the inbox.';

create index support_sends_user_recent_idx
  on public.support_sends (user_id, sent_at desc);

alter table public.support_sends enable row level security;

-- No policies, on purpose. `enable row level security` with none defined is a
-- deny-all for every role that goes through RLS; the service role bypasses it.
-- The explicit revoke is belt and braces against a future grant to the
-- authenticated role wandering in from a schema-wide statement.
revoke all on table public.support_sends from anon, authenticated;
