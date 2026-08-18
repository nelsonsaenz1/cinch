-- ===========================================================================
-- Trip Detail — the note.
--
-- Redesign 06 gives the trip page a note field ("Gift for Alexandria goes in
-- the carry-on"). It is the one thing on that screen the device cannot hold
-- for the user: the packing TICKS are local by design — the accepted error
-- frame says "what you already ticked is safe on this device" in as many
-- words, because a tick is about this suitcase in this room — but a sentence
-- somebody typed is content, and content that evaporates on reinstall is
-- content the app lost.
--
-- ONE COLUMN, NOTHING ELSE. No table, no policy, no grant, no index: `trips`
-- is already owner-only under four per-command policies, already carries the
-- `set_updated_at` trigger, and every read of this column goes through the
-- same `user_id = auth.uid()` filter as the row it lives on.
--
-- NO UGC FILTER, DELIBERATELY. `20260808100000_ugc_text_filter` cleans the
-- text other people can see — comments, posts, events, borrow requests,
-- profiles. A trip has no sharing path and no public view (see the header of
-- `20260809100000_trips`), so this string is never rendered to anybody but
-- the person who typed it, and running someone's private note through a
-- content filter would be the app reading mail it has no business reading.
--
-- DEFAULTED, NOT NULLABLE. Null and empty string would mean the same thing to
-- every reader and differ only in which one a writer happened to send, so the
-- column has one representation of "no note". Existing rows take the default
-- without a rewrite (Postgres 11+ stores it in the catalogue), so this is a
-- metadata-only change on a live table.
--
-- The cap is a sentence or two of packing reminder, not an essay: long enough
-- that nobody hits it in the use the frame draws, short enough that a runaway
-- paste cannot bloat a row that is also carrying a jsonb memo.
-- ===========================================================================

alter table trips
  add column note text not null default ''
    check (char_length(note) <= 2000);

comment on column trips.note is
  'Owner-private packing note — Trip Detail, redesign 06. Never shown to anyone but the owner.';
