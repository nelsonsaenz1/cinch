-- Which merchants Cinch is actually JOINED to, which is not the same question
-- as which merchants Cinch can build a tracking link for.
--
-- THE DISTINCTION THIS TABLE EXISTS TO MAKE
--
-- `_shared/commerce.ts` can construct a valid Awin or Rakuten redirect for any
-- merchant on those networks, because building the URL only needs our publisher
-- id and the merchant's id. The link will resolve. A shopper will reach the
-- shop. None of that means Cinch earns anything: commission requires an
-- APPROVED programme membership, and as of 2026-08-11 Awin reports
-- `joined = 0` — every application still pending.
--
-- So "we produced a tracking URL" was being treated as "this is a paid link",
-- and the app labelled every result `Paid link` on that basis. That is a
-- disclosure being wrong in the direction that matters: it tells a user we are
-- paid to show them something when we are not, which is a claim about our own
-- motives, made to their disadvantage, and false.
--
-- A row here is a deliberate statement that a programme approval has landed.
-- Empty is the correct state today, and while it is empty every result is shown
-- as an ordinary link to the shop.
create table commerce_joined_programmes (
  network       text not null check (network in ('awin', 'rakuten')),
  -- The merchant id as the NETWORK numbers it — the same value that goes into
  -- `awinmid` / `mid`. Text because Rakuten's are not always integers.
  merchant_id   text not null check (char_length(merchant_id) between 1 and 64),
  -- Human-readable, for whoever reads this table in six months.
  merchant_name text not null check (char_length(merchant_name) between 1 and 200),
  -- When the network confirmed it. Not when we applied.
  joined_at     timestamptz not null default now(),
  -- Approvals get revoked; a lapsed programme stops paying without telling us.
  active        boolean not null default true,
  note          text,
  primary key (network, merchant_id)
);

comment on table commerce_joined_programmes is
  'Merchants whose affiliate programme Cinch has been APPROVED for. Presence here is the only thing that may cause a result to be labelled a paid link. Being able to build a tracking URL is not evidence of membership.';

alter table commerce_joined_programmes enable row level security;
-- No policies. Server-only, like the rest of the catalogue.

revoke all on table commerce_joined_programmes from anon, authenticated;
grant all on table commerce_joined_programmes to service_role;
