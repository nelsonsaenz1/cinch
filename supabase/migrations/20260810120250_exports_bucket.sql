-- The bucket a data export lands in.
--
-- RECOVERED 2026-08-10. Shipped to production as
-- `20260810124142_exports_bucket` and never written to the repo — the third and
-- last of the orphans. See docs/ci/migration-replay.md.
--
-- This one was the most dangerous of the three to be missing. `build-export`
-- writes here, and a rebuild from the repo would have produced a database where
-- the whole data-export path fails at the upload with no bucket to write to —
-- which is the GDPR access path, on an app whose privacy policy promises it.
--
-- Ordered between `support_sends` and `invite_card_falls_back_to_handle`,
-- matching production's own sequence.

-- Private: reach is by signed URL only, and the URL is what expires after seven
-- days. A public bucket would make "the link expires" a decoration rather than
-- a mechanism.
insert into storage.buckets (id, name, public)
values ('exports', 'exports', false)
on conflict (id) do nothing;

-- No storage policies at all, on purpose. Nothing reads this bucket through a
-- user session: the edge function writes with the service role and hands back a
-- signed URL, which needs no policy to redeem. A select policy here would be a
-- second, weaker door to the same objects.
