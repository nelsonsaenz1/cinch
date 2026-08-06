-- ===========================================================================
-- Profile editing: somewhere to keep a face, and a ceiling on `bio`.
--
-- `profiles` has carried `display_name`, `avatar_url`, `bio` and `username`
-- since the first two migrations, but nothing has ever WRITTEN them — there
-- was no settings UI. (`username` is the load-bearing one: eleven files READ
-- it, including friend search, so "find a friend by username" has been
-- searching a column no user could fill.) The edit-profile flow is that UI,
-- and it needs three things the schema does not have yet.
--
-- 1. A bucket for avatars.
--
--    NOT `garments`. That bucket is private, its objects are keyed
--    {user}/{item}/{file}, and every read path — owner, friend, event
--    co-member, published item — authorises on the SECOND path segment being
--    an item id (20260807103000). An avatar has no item, so it would land
--    outside every one of those policies and be readable by nobody but its
--    owner. The people who need to see an avatar are exactly the people the
--    social projections already hand `avatar_url` to.
--
--    PUBLIC, deliberately, because that is what `avatar_url` already means
--    everywhere it is consumed. `public_profiles` and `social_profiles` both
--    select the column, and every renderer (components/social/ProfileRow,
--    components/ui/avatar) passes it straight to <Image source={{ uri }}> with
--    no signing step. A private bucket would make the column a path rather
--    than a URL and break every one of those call sites at once. So: a public
--    bucket, an unguessable object name, and the same owner-folder write rules
--    as `garments`. The image is a profile photograph the user has chosen to
--    show other people; the URL is the only thing that is public about it, and
--    it is not enumerable — `list` still requires the owner SELECT policy
--    below.
--
--    JPEG only and 2 MB, enforced at the bucket: the client downscales to a
--    512px square before uploading (features/profile/avatar.ts), so anything
--    arriving outside these bounds did not come from this app.
--
-- 2. A way to ask whether a handle is free. Uniqueness is already enforced
--    (a unique index on lower(username), 20260803210000) — what is missing is
--    a read the claim form is allowed to perform. See the function below.
--
-- 3. A length on `bio`.
--
--    `bio text` with no constraint means the edit form's character counter is
--    a suggestion the database does not share. 280 is the cap the form counts
--    against; the constraint is what makes the count true.
--
-- No change here touches an existing read path, and nothing here is a table grant:
-- storage.objects grants are the platform's, and `profiles` already carries
-- the full verb list for authenticated (20260806100000).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- The avatars bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

-- Writes are owner-folder scoped, exactly as `garments` is: objects are keyed
-- {user_id}/{filename}, so authorisation reads the first path segment. A
-- signed upload URL (storage.createSignedUploadUrl) is minted against the
-- INSERT policy, which is why upload and update are separate policies — a
-- re-upload to the same key needs both.
create policy "avatars: owner can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars: owner can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Replacing a photograph deletes the one it replaces; removing a photograph
-- deletes it outright. Without this the bucket accumulates every avatar a
-- user has ever had, all of them still served from a public URL.
create policy "avatars: owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Reading an avatar does NOT go through this policy — a public bucket is
-- served from /object/public/{bucket}/{path}, which does not evaluate RLS.
-- This exists so the owner can `list` her own folder (which the public route
-- cannot do), which is how the client finds the object it is about to
-- replace. Scoped to the owner: nobody gets to enumerate anyone else's.
create policy "avatars: owner can list" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ---------------------------------------------------------------------------
-- Is this handle free?
--
-- `username` uniqueness is already enforced — a unique index on
-- lower(username), plus a format check (20260803210000). What is missing is a
-- way for the claim form to ASK before it submits.
--
-- It has to be a definer function. `profiles` RLS lets a signed-in user see
-- her own row and rows whose `visibility = 'public'`, so a client-side
-- `select … where lower(username) = …` reports "available" for every handle
-- held by a PRIVATE account — which is most of them. The form would promise a
-- handle it cannot deliver and the save would fail on 23505 anyway. Same
-- pattern, and same reasoning, as `is_friend` (20260807100000): the row check
-- the caller may not perform lives in one narrow definer function.
--
-- It answers `true`/`false` and nothing else. That is an existence oracle over
-- handles by construction — as every sign-up form on the internet is — and it
-- is the minimum required to answer the question. It never returns a user id,
-- a display name, or anything that would turn "taken" into "taken by whom".
-- The caller's own handle reads as available, so re-saving an unchanged form
-- does not tell the user her own handle is gone.
-- ---------------------------------------------------------------------------

create function username_available(p_username text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (
    select 1 from public.profiles p
     where lower(p.username) = lower(btrim(p_username))
       and p.user_id <> (select auth.uid()));
$$;

revoke execute on function username_available(text) from public, anon, authenticated;
grant execute on function username_available(text) to authenticated;

-- ---------------------------------------------------------------------------
-- bio, bounded
-- ---------------------------------------------------------------------------

-- Defensive, not expected to move a row: no shipped surface has ever written
-- `bio`. If a longer one exists it was seeded by hand, and truncating it is
-- better than a migration that cannot replay.
update profiles set bio = left(bio, 280) where char_length(bio) > 280;

alter table profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 280);
