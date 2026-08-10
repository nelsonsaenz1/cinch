-- invite_card returned null for two different things: "no such handle" and
-- "that handle exists but never set a display name". The landing page cannot
-- tell them apart, so it rendered IV-05 — "this invite has been closed" — for
-- a perfectly live account. Anyone who skipped the display name had a dead
-- invite link and no way to discover it.
--
-- Found by building the web page against the RPC rather than against a
-- description of it; nothing in the app would ever have surfaced it, because
-- the app already has the profile row and never calls this function.
--
-- The handle is a name people already use for themselves, so falling back to
-- it keeps the page truthful ("@ada added you on Cinch") rather than denying
-- that the account exists. Null now means exactly one thing: nobody there.
create or replace function public.invite_card(p_handle text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(nullif(btrim(p.display_name), ''), '@' || p.username)
    from public.profiles p
   where p.username = lower(ltrim(p_handle, '@'))
     and p.deletion_requested_at is null
   limit 1;
$$;
