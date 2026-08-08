-- Listing imagery — the founder's 2026-08-08 direction: a garment the user
-- photographed can be re-dressed with the retailer's own listing photo once
-- the user confirms the match. The photo is DOWNLOADED into our bucket by the
-- garment-search function (same path the Describe flow already uses), never
-- hot-linked, so `listing_path` is a Storage path exactly like `plate_path`.
--
-- Additive only: nothing existing changes meaning, no RLS change is needed —
-- the columns ride the items table's own user_id policies.

alter table public.items
  -- Storage path of the confirmed listing image in the garments bucket.
  add column if not exists listing_path text,
  -- The product page the image came from — attribution and the user's way back.
  add column if not exists listing_source_url text,
  -- Human label for the source ("arket.com"), shown under the image.
  add column if not exists listing_source_label text,
  -- When the user confirmed the match. Null = no listing image.
  add column if not exists listing_confirmed_at timestamptz;

comment on column public.items.listing_path is
  'Storage path of the user-confirmed retailer listing image (garments bucket). Displayed in preference to cutout imagery when present.';
