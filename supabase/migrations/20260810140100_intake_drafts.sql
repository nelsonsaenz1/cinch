-- The Walkthrough, part two of three: parsed garments, staged.
--
-- Spec: docs/design/voice-intake-directive.md §5.2 — "the single most
-- important design decision in the build".
--
-- WHY THESE DO NOT GO STRAIGHT INTO items
--
-- `items_enforce_limit` is a BEFORE INSERT trigger on items
-- (20260805160000_membership_tiers.sql:283) and it RAISES. A free user who
-- speaks forty garments would take a raw check_violation on row eleven, in the
-- middle of a procession, with nineteen confirmed cards already written and
-- twenty-one lost.
--
-- Staging moves the ceiling to one place: commit. There it fires exactly once,
-- as V-12 — a designed screen that says "you own forty pieces, free keeps ten
-- awake" — instead of an error dialog. Nothing is deleted and nothing is lost,
-- which is standing refusal §4.6 of the reframe directive.
--
-- The second reason is cheaper to say and just as load-bearing: a draft is not
-- yet a garment. A user who abandons a walkthrough should not find twenty
-- half-confirmed things in their closet.

create table public.intake_drafts (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.intake_sessions (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,

  -- Spoken order. The procession reads this, and intake_sessions.cursor
  -- indexes into it.
  ordinal        integer not null check (ordinal >= 0),

  -- THE RECEIPT LINE. Not null, ever.
  --
  -- This is the single most protected string in the wave — reframe directive
  -- §12: "a quoted mishearing is forgiven instantly; a confidently wrong
  -- garment with no provenance makes people stop trusting the entire closet."
  -- The not-null is the enforcement. A draft that cannot say what it heard
  -- cannot be shown.
  utterance      text not null check (length(trim(utterance)) > 0),

  name           text not null check (length(trim(name)) > 0),

  -- Must match the engine's Slot union (src/lib/styling/types.ts:11). Checked
  -- here rather than trusted, because the value arrives from a language model
  -- and an unknown slot would commit a garment the styling engine cannot place.
  slot           text not null
                   check (slot in ('base_top','mid_layer','bottom','dress','outerwear',
                                   'footwear','bag','headwear','accessory')),

  -- 'navy'. Never a hex — §4.9: the model returns a colour term and the app
  -- maps it through the lexicon in src/lib/color/.
  colour_term    text not null check (length(trim(colour_term)) > 0),

  -- Resolved app-side from the lexicon. Shape: {"l":..,"c":..,"h":..,"hex":"#RRGGBB"}.
  -- The hex is carried alongside the OKLCH because items.colors is a
  -- [{hex,name}] array and commit_intake_session has no colour maths of its
  -- own — see 20260810140200.
  colour_oklch   jsonb,

  fabric         text,
  pattern        text,

  -- Bounded to match items.formality_score / items.warmth_score, which are
  -- `check between 1 and 5`. NOT in the directive's schema, and deliberately
  -- added: an out-of-range value here would raise at commit, inside the one
  -- transaction this whole table exists to keep clean.
  formality      smallint check (formality is null or formality between 1 and 5),
  warmth         smallint check (warmth    is null or warmth    between 1 and 5),

  quantity       smallint not null default 1 check (quantity between 1 and 12),

  confidence     real not null default 1.0 check (confidence between 0 and 1),

  state          text not null default 'pending'
                   check (state in ('pending','confirmed','rejected','ambiguous')),

  -- Only ever a user-supplied photograph, from V-08's optional upgrade. Never
  -- a sourced or scraped image — reframe directive §4.1, and the reason the
  -- App Store description can say "nothing is a catalogue photo".
  image_path     text,

  created_at     timestamptz not null default now(),

  unique (session_id, ordinal)
);

comment on table public.intake_drafts is
  'Parsed garments, staged. Not items — see docs/design/voice-intake-directive.md §5.2 for why the plan ceiling must fire at commit and not mid-procession.';
comment on column public.intake_drafts.utterance is
  'The receipt line: what the user actually said. Never null. A card that cannot quote its source is not shown.';
comment on column public.intake_drafts.colour_oklch is
  'Lexicon-resolved colour: {"l","c","h","hex"}. The hex feeds items.colors at commit; the model never supplies it.';
comment on column public.intake_drafts.image_path is
  'A photograph the user chose to add (V-08). Never a sourced image.';

-- The procession walks one session in ordinal order; the commit reads the
-- confirmed subset of one session in ordinal order. Both are this index.
create index intake_drafts_session_ordinal_idx
  on public.intake_drafts (session_id, ordinal);

create index intake_drafts_user_idx
  on public.intake_drafts (user_id);

-- ---------------------------------------------------------------------------
-- RLS. Owner-only, all four verbs — same reasoning as intake_sessions.
--
-- Note these are keyed on the draft's OWN user_id rather than joined through
-- intake_sessions. A join would make every policy depend on a second table's
-- policies being right, and the denormalised user_id is already there because
-- the cascade needs it.
-- ---------------------------------------------------------------------------

alter table public.intake_drafts enable row level security;

-- See the note in 20260810140000: new tables carry no client-role grants, so
-- this line is what makes the policies below reachable at all.
grant select, insert, update, delete on public.intake_drafts to authenticated;

create policy intake_drafts_select_own
  on public.intake_drafts for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy intake_drafts_insert_own
  on public.intake_drafts for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy intake_drafts_update_own
  on public.intake_drafts for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy intake_drafts_delete_own
  on public.intake_drafts for delete
  to authenticated
  using (user_id = (select auth.uid()));
