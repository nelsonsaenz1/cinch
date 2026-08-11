-- The affiliate product catalogue — Awin and Rakuten.
--
-- WHY A CATALOGUE AND NOT A LIVE SEARCH
-- -------------------------------------
-- `garment-search` currently finds product images by asking a web-searching
-- model for pages and then scraping each page's `og:image`. That works, and it
-- carries three costs this table removes: every tile costs a model call plus an
-- Exa search; the image is whatever the page happened to put in a meta tag; and
-- the search leg runs through a provider whose terms take a perpetual licence
-- over the query (supabase/functions/garment-search/provider.ts L311-333).
--
-- A merchant feed answers all three. It hands us the product image directly,
-- as the merchant published it, under a licence we hold — and the row already
-- carries the product URL, which is what a tracking link is built from. One
-- ingest, then local queries at no per-search cost.
--
-- THE RULE THIS SCHEMA HAS TO PROTECT (commerce-directive.md §0)
-- -------------------------------------------------------------
-- Commission may never influence what Cinch recommends, in what order, or how
-- loudly. That is why **there is no commission column in this schema.** Not a
-- rate, not an EPC, not a payout band. The ranking function computes its order
-- from the user's own closet before any merchant is consulted, and a column
-- that does not exist cannot be read into a sort by a later well-meaning edit.
-- If earnings need recording one day, they belong in a separate table that
-- nothing in the ranking path may import.
--
-- ACCESS: SERVER ONLY
-- -------------------
-- No grant to `anon` or `authenticated` on either table. Clients never query
-- the catalogue directly — they receive candidates from `garment-search` and
-- gap products from `wishlist_items`, both of which are already per-user and
-- already policed. A shared catalogue readable by every session is a scraping
-- surface for a competitor and buys us nothing the edge functions cannot do.
-- Ground rules held (20260807100000 §0): no `to anon` policy on a base table,
-- explicit grants only, no `security_invoker = true` view.

-- ---------------------------------------------------------------------------
-- Merchants we have an approved relationship with
-- ---------------------------------------------------------------------------

create table public.catalog_merchants (
  id           uuid primary key default gen_random_uuid(),
  -- Which network the relationship lives in. The tracking-link format and the
  -- feed endpoint both branch on this, so it is an enum-by-check rather than
  -- free text.
  network      text not null check (network in ('awin', 'rakuten')),
  -- Awin calls this the advertiser ID; Rakuten calls it the MID. Same idea,
  -- and it is the value that goes into the tracking URL, so it is text rather
  -- than an integer — neither network promises it stays numeric.
  external_id  text not null check (length(external_id) between 1 and 64),
  name         text not null check (length(name) between 1 and 200),
  -- Awin feed downloads are addressed by advertiser id plus vertical plus
  -- locale; Rakuten is queried live and has no feed id. Null means "this
  -- network does not use one", not "unknown".
  feed_locale  text check (length(feed_locale) between 1 and 16),
  -- Turned off without deleting, so an approval that lapses stops appearing in
  -- results while its products remain attached to the garments people already
  -- matched against them.
  active       boolean not null default true,
  approved_at  timestamptz not null default now(),
  synced_at    timestamptz,
  -- The last sync's outcome, so a feed that has been quietly failing for a
  -- week is visible as a fact rather than as an absence of new products.
  sync_error   text,

  unique (network, external_id)
);

comment on table public.catalog_merchants is
  'Advertisers whose product feeds Cinch may use. Deliberately carries no commission rate — see commerce-directive.md §0.';

-- ---------------------------------------------------------------------------
-- The products
-- ---------------------------------------------------------------------------

create table public.catalog_products (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.catalog_merchants(id) on delete cascade,
  -- The merchant's own product id, `id` in Awin's Google-format feed. Unique
  -- per merchant, which is what makes a re-sync an upsert rather than a
  -- truncate — a garment matched to a product must survive the next sync.
  external_id   text not null check (length(external_id) between 1 and 64),

  title         text not null check (length(title) between 1 and 150),
  brand         text check (length(brand) between 1 and 70),
  colour        text check (length(colour) between 1 and 100),

  -- Integer minor units. A float price is a rounding bug waiting for a
  -- currency with three decimal places.
  price_cents   integer check (price_cents >= 0),
  currency      text check (currency ~ '^[A-Z]{3}$'),

  -- `image_link` in the feed. The whole reason this table exists.
  image_url     text not null check (image_url like 'https://%'),
  -- `link` in the feed — the merchant's own untracked product URL. The
  -- tracking URL is DERIVED from this at read time and never stored, so a
  -- change of publisher id or network cannot leave stale links in the data.
  product_url   text not null check (product_url like 'https://%'),

  availability  text not null default 'in_stock'
                  check (availability in ('in_stock', 'out_of_stock', 'preorder', 'backorder')),
  -- Google's taxonomy, as the feed supplies it. Kept raw; mapping it onto
  -- Cinch's own ten categories is the ingest function's job, not the column's.
  google_category text check (length(google_category) <= 500),
  -- Cinch's own slot, resolved at ingest. Null when the feed's category could
  -- not be mapped — those rows are still searchable by text but never fill a
  -- computed gap, because a gap is expressed in slots.
  slot          text check (slot in (
                  'top', 'bottom', 'outerwear', 'footwear', 'dress',
                  'accessory', 'bag', 'headwear', 'jewelry', 'other')),

  updated_at    timestamptz not null default now(),

  unique (merchant_id, external_id)
);

comment on table public.catalog_products is
  'Products from approved merchant feeds. product_url is the untracked merchant URL; the tracking link is derived at read time.';

-- Text search over title and brand — the query the garment provider runs.
create index catalog_products_search_idx
  on public.catalog_products
  using gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(brand, '')));

-- Gap fills are looked up by slot, and only in-stock products are offerable.
create index catalog_products_slot_idx
  on public.catalog_products (slot, availability)
  where availability = 'in_stock';

create index catalog_products_merchant_idx
  on public.catalog_products (merchant_id);

-- ---------------------------------------------------------------------------
-- Lock both tables down
-- ---------------------------------------------------------------------------

alter table public.catalog_merchants enable row level security;
alter table public.catalog_products  enable row level security;

-- No policies. RLS with zero policies denies everything to every role that is
-- subject to it, which is exactly the intent: only `service_role` — which
-- bypasses RLS — touches these, and only from an edge function.
--
-- Grants are revoked rather than merely left unstated, because `public` may
-- carry defaults from the database's history and an implicit grant is not a
-- decision anybody made.
revoke all on public.catalog_merchants from anon, authenticated;
revoke all on public.catalog_products  from anon, authenticated;

grant all on public.catalog_merchants to service_role;
grant all on public.catalog_products  to service_role;
