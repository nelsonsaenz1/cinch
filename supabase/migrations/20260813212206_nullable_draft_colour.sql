-- ---------------------------------------------------------------------------
-- A colour the parse could not hear is null, not grey.
--
-- `intake_drafts.colour_term` was NOT NULL, and the schema above it required
-- the value from an enum — so every garment somebody described without naming a
-- colour had to be given one. `normalizeGarments` supplied it: anything
-- unrecognised became `'grey'`.
--
-- That is a confident invention on the one screen where a confident invention
-- costs the most. Somebody says "my linen shirt", the review card says grey,
-- and either they catch it or they now own a grey shirt they do not have —
-- filed with a colour the styling engine will trust and plan outfits around,
-- because `colour_oklch` is derived from this column and the scorer reads it as
-- ground truth.
--
-- The plan's rule for this workstream is exact: "Never guess an absent color;
-- leave it unresolved for review rather than inventing the likely value." This
-- migration is what makes that expressible.
--
-- WHY THIS IS SAFE
--
-- Dropping NOT NULL is a widening: every existing row still satisfies the
-- column, no data moves, and nothing that reads the column can be handed a
-- value it could not previously receive EXCEPT null — which is the point, and
-- which the client now draws as an explicit "colour not caught" state rather
-- than a default swatch.
--
-- No index, constraint or policy references this column, and it is not part of
-- any key. `colour_oklch` beside it has always been nullable, so the pairing is
-- now consistent: no term, no colour.
-- ---------------------------------------------------------------------------

alter table public.intake_drafts alter column colour_term drop not null;

comment on column public.intake_drafts.colour_term is
  'The spoken colour, from the fixed lexicon, or NULL when the description did '
  'not name one. Never a guessed default — an unresolved colour is asked about '
  'on the review card. See supabase/functions/_shared/closet-parse.ts.';
