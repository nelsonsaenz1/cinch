-- ===========================================================================
-- Make the client roles' table privileges explicit.
--
-- CI's fresh replay exposed real drift: production's `authenticated` grants on
-- every app table came from Supabase's PROJECT-CREATION default privileges,
-- not from any migration — and the current CLI image's defaults differ, so a
-- clean replay produced a database where authenticated could not SELECT items.
-- Ambient platform defaults are not a schema; this writes down the access
-- matrix so replay, production and intent are the same thing.
--
-- The verb list per table is derived from the RLS policies themselves (the
-- policies define which rows; these grants define which verbs — the two must
-- agree or the policy is dead letter). anon gets NOTHING on base tables, by
-- design: every anonymous read the product will ever offer goes through the
-- public_* projection views, which are themselves revoked until the social
-- surface ships (20260805213000).
--
-- Storage note: the garments-bucket policies that would let anon read a
-- PUBLIC item's thumb/cutout reference `items` in their USING clause, so with
-- no anon grant on items they error rather than filter. No shipped path reads
-- storage as anon — the app uses signed URLs minted by the service role — so
-- that surface stays parked with the social feature and the tests assert the
-- refusal.
-- ===========================================================================

grant select, insert, update, delete on profiles        to authenticated;
grant select, insert, update, delete on items           to authenticated;
grant select, insert, update, delete on outfits         to authenticated;
grant select, insert, update, delete on outfit_items    to authenticated;
grant select, insert, update, delete on outfit_calendar to authenticated;
grant select, insert, update, delete on chat_sessions   to authenticated;
grant select, insert, update, delete on style_profiles  to authenticated;
grant select, insert, update, delete on wardrobe_gaps   to authenticated;
grant select, insert, update, delete on wishlist_items  to authenticated;

grant select, insert, delete on chat_messages    to authenticated;
grant select, insert, delete on closet_likes     to authenticated;
grant select, insert, delete on follows          to authenticated;
grant select, insert, delete on outfit_reactions to authenticated;
grant select, insert, delete on style_feedback   to authenticated;

grant select, insert, update on command_log    to authenticated;
grant select, insert, update on item_inquiries to authenticated;

grant select, insert on tag_corrections to authenticated;

grant select on ai_calls          to authenticated;
grant select on ai_config         to authenticated;
grant select on ai_usage_counters to authenticated;
grant select on subscriptions     to authenticated;
