-- Commerce preferences — commerce-directive.md C-03 and C-05.
--
-- Two independent, owner-held booleans on `profiles`. Independent on purpose:
-- one is "do I want to SEE shop suggestions" (my own screen), the other is "do
-- I consent to being FOUND AND SOLD TO by a friend" (someone else's screen).
-- Conflating them would mean turning off your own shop rows also hid your
-- pieces from friends, or that becoming shoppable also switched your own Gap
-- Feed on — neither is true, and the directive draws them as two separate
-- questions for exactly that reason.
--
-- No new grant is needed: `profiles` already carries `to authenticated` table
-- grants (20260806100000) and the four owner-scoped RLS policies
-- (20260803154431) cover any column added to the table, the same way
-- ai_consent_version (20260808120000) needed neither.
--
-- Neither column is added to `public_profiles` or `social_profiles` — both are
-- column-explicit projections (verified against 20260808110000 and
-- 20260804200000), so a column added here is invisible through them by
-- construction, same note 20260803154431 makes for ai_consent_revoked_at.

alter table public.profiles
  -- C-03 — "Show where to buy". Profile → Settings, default ON: the Gap Feed
  -- merchant row and the friend "Find it" link both check this before
  -- rendering anything, and the Edge Function checks it again server-side
  -- (defense in depth, same posture as ai_consent_version) so turning it off
  -- removes every merchant row and product sheet app-wide, not just the ones
  -- already on screen.
  add column show_where_to_buy boolean not null default true,
  -- C-05 — "Let friends find where your pieces are from". Profile → Privacy,
  -- default OFF. A SEPARATE flag from every closet-visibility toggle
  -- (closet_hidden, stat_*_hidden — 20260808110000): visibility controls what
  -- a friend can SEE, this controls what a friend may BUY. Off by default
  -- because it is consent to be sold to, not a display preference, which is
  -- also why its default is the opposite of show_where_to_buy above.
  add column shoppable boolean not null default false;

comment on column public.profiles.show_where_to_buy is
  'Gap Feed merchant rows and the friend "Find it" link, on THIS account''s own screens. Off removes every merchant row and product sheet app-wide — commerce-directive.md C-03.';
comment on column public.profiles.shoppable is
  'Owner consent for OTHER people to find where THIS profile''s pieces are sold. Off by default. Never implies the owner earns anything from a friend''s purchase, and the owner is never told who looked — commerce-directive.md C-05, §6 refusal 4.';

-- friend_items, recreated with shoppable appended at the end — same reason
-- 20260808110000 appended wear_count/last_worn_at there: `create or replace
-- view` refuses column reordering. The Friend's Closet item detail (C-04)
-- needs this per piece to decide whether "Find it" renders at all; a
-- coalesce to false covers the (should-be-impossible, since the column is
-- `not null`) case of a null join defensively rather than crashing a sheet.
create or replace view friend_items
with (security_invoker = false) as
  select i.id, i.user_id, i.category, i.subcategory, i.colors, i.pattern,
         i.material, i.brand, i.seasons, i.occasions, i.description,
         i.thumb_path, i.cutout_path, i.plate_path, i.borrowable, i.created_at,
         i.wear_count, i.last_worn_at,
         coalesce(
           (select p.shoppable from public.profiles p where p.user_id = i.user_id),
           false
         ) as shoppable
    from items i
   where not i.is_archived
     and is_friend(i.user_id)
     and exists (select 1 from profiles p
                  where p.user_id = i.user_id and not p.closet_hidden);
