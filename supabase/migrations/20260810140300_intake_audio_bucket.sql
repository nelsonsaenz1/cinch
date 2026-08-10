-- Where a walkthrough's audio lives, briefly.
--
-- Spec: docs/design/voice-intake-directive.md §7 and §8.
--
-- THE SHORTEST-LIVED OBJECT IN THE APP
--
-- Audio of someone describing their closet IS their closet, said out loud in
-- their own voice. It is the most sensitive thing this product has ever
-- stored, and the only reason it is stored at all is that a transcription call
-- needs something to fetch.
--
-- So the lifecycle is: uploaded, transcribed, DELETED — on success, by
-- `transcribe-intake` itself, in the same request. On failure the object is
-- kept so the user can retry without speaking again, and the sweep below reaps
-- anything older than 24 hours whatever its state.
--
-- The app tells the user this at V-01, before the microphone opens: "The
-- recording is transcribed and deleted. Cinch keeps the words, never the
-- audio." §8 requires that sentence to be true, and this file is most of what
-- makes it true. If retention ever changes, the sentence changes first.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'intake-audio',
  'intake-audio',
  false,
  -- 25 MB, matching §7's server-side cap. Twelve minutes of compressed speech
  -- is comfortably under this; anything at the limit is not a walkthrough.
  26214400,
  array['audio/m4a','audio/mp4','audio/aac','audio/mpeg','audio/wav','audio/webm']
)
on conflict (id) do update
  set file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public            = false;

-- Same {user_id}/… prefix convention as `garments`, so the first path segment
-- is the authorization key.
create policy "intake-audio: owner can read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'intake-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "intake-audio: owner can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'intake-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Deletable by the owner, deliberately and without a retention window. A user
-- who changes their mind about a recording should not have to wait for a cron
-- job, and there is nothing here worth protecting from its own author.
create policy "intake-audio: owner can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'intake-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- No update policy. An object is written once and then read once; a rewritable
-- audio path would let a caller swap the file between upload and transcription.

/**
 * reap_intake_audio — the backstop.
 *
 * `transcribe-intake` deletes on success and the client deletes on abandon, so
 * in the ordinary case this finds nothing. It exists for the cases that are not
 * ordinary: a function that timed out after uploading, an app killed between
 * upload and transcription, a retry the user never came back to.
 *
 * 24 hours, per §8. Definer because storage.objects is not the caller's to
 * sweep, and it takes no arguments so there is no path to it that names
 * somebody else's file.
 */
create or replace function public.reap_intake_audio()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  with gone as (
    delete from storage.objects
     where bucket_id = 'intake-audio'
       and created_at < now() - interval '24 hours'
    returning 1
  )
  select count(*) into v_deleted from gone;

  return v_deleted;
end;
$$;

comment on function public.reap_intake_audio() is
  'Deletes intake audio older than 24h. A backstop — the happy path deletes on transcription. See docs/design/voice-intake-directive.md §8.';

revoke execute on function public.reap_intake_audio() from public, anon, authenticated;
grant  execute on function public.reap_intake_audio() to postgres;

create extension if not exists pg_cron;

-- Re-runnable, matching 20260810120500: cron.schedule would otherwise raise on
-- a replay, and these migrations have to survive being applied to a fresh
-- branch.
do $$
begin
  if exists (select 1 from cron.job j where j.jobname = 'cinch-reap-intake-audio') then
    perform cron.unschedule('cinch-reap-intake-audio');
  end if;
end;
$$;

-- Hourly, at seventeen past. The window it enforces is 24 hours, so the exact
-- minute is irrelevant; the offset just keeps it off the top of the hour where
-- every other job in the project already sits.
select cron.schedule('cinch-reap-intake-audio', '17 * * * *',
                     $sql$select public.reap_intake_audio();$sql$);
