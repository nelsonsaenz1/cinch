-- ---------------------------------------------------------------------------
-- Catalogue Photo V2 — the four schema facts a batch import needs.
--
-- The matcher lets somebody pick several colourways of one garment and add them
-- together. Four things about that are not expressible in the schema as it
-- stands, and each of them is a way to tell the user something untrue.
--
--   1. A RETRY MUST NOT DUPLICATE A GARMENT. A batch import is N writes over a
--      mobile connection; some succeed, some do not, and the recovery is to
--      send the failures again. Without a durable key, "send the failures
--      again" is indistinguishable from "add three more shirts" whenever the
--      first attempt actually landed and the response was lost — which is the
--      single most likely failure on a phone, not an exotic one.
--
--      `catalog_external_id` is Datafeedr's own row id for the colourway. It is
--      stable, it is already carried on every `CatalogProduct`, and a partial
--      unique index on (user_id, catalog_external_id) makes the second write a
--      constraint violation rather than a second shirt. Partial, because every
--      garment that did not come from the catalogue leaves it null and NULLs do
--      not collide.
--
--   2. A CATALOGUE COLOUR IS NOT A MEASURED ONE. `colour_source` has meant
--      'measured' (from the garment's own pixels) or 'spoken' (from a word,
--      through the lexicon) since 20260810140200. A catalogue import is neither:
--      the colour is the MERCHANT'S word for their own product photograph, and
--      the pixels belong to a studio shot of a different physical garment than
--      the one in the user's wardrobe.
--
--      Filing it as 'measured' would tell the harmony scoring it has ground
--      truth when it has a stock photo's white balance — the exact failure
--      `docs/design/voice-intake-directive.md` §0.3 warns about. Filing it as
--      'spoken' would be a lie of a different kind, and the packet is explicit
--      that 'spoken' may not be repurposed. So the value is its own.
--
--      Today's import path writes nothing and takes the column default, which
--      is 'measured' — so every listing photo already in a closet is currently
--      claiming measured colour. This migration does not rewrite those rows:
--      backfilling would require deciding, for each one, whether its colour was
--      ever actually measured by the tagging pass that ran afterwards, and that
--      is a question the row cannot answer. New imports are correct from here;
--      the existing ones are named as a blocker rather than quietly relabelled.
--
--   3. A CATALOGUE IMPORT IS NOT A PHOTOGRAPH. `intake_method` defaults to
--      'photo', so an import currently counts as camera intake in the one
--      analytics cut that exists to tell the routes apart. 'catalogue' is added
--      alongside it. Rows written before today are likewise not backfilled, and
--      for the same reason: nothing recorded at the time separates a listing
--      import from an upload.
--
--   4. CAPACITY HAS TO BE ANSWERABLE BEFORE THE FIRST WRITE. The batch is
--      all-or-nothing at the door: three colourways into two free slots must be
--      refused as a batch, not half-written and then apologised for. The client
--      already computes this for display (`use-capacity.ts`) but a client
--      computing a boundary is a client an attacker patches, and that file says
--      so itself. `import_capacity()` puts the same two counts the TRIGGER uses
--      in one place, in SQL, callable by the Edge Function.
--
--      It is a PREFLIGHT and not a claim. `enforce_item_limit` remains the only
--      authority: between the preflight and the third insert a garment can
--      arrive from another device, and the trigger refuses it. The preflight
--      exists so the common case fails before any bytes are downloaded, not so
--      the trigger can be trusted less.
-- ---------------------------------------------------------------------------

-- 1 · The idempotency key --------------------------------------------------

alter table public.items
  add column if not exists catalog_external_id text;

comment on column public.items.catalog_external_id is
  'Datafeedr''s own row id for the colourway this garment was imported from. NULL for every garment that did not come from the licensed catalogue, which is most of them. Exists so that retrying a partly-failed batch import cannot create a second copy of a shirt — see the partial unique index below.';

-- Partial, so the millions of null rows never collide with each other. Unique
-- per user rather than globally: two people may own the same shirt, and the
-- question this answers is "have I already imported this one", not "does it
-- exist".
create unique index if not exists items_user_catalog_external_id_key
  on public.items (user_id, catalog_external_id)
  where catalog_external_id is not null;

-- 2 · Where a catalogue colour comes from ----------------------------------
--
-- Dropped before it is added. `ADD CONSTRAINT` is the one piece of DDL here
-- with no `IF NOT EXISTS` form, and an unguarded one is what broke the
-- production replay on 2026-08-10 — see docs/ci/migration-replay.md and
-- tests/migration-replay.test.ts, which fails this file without the pairing.

alter table public.items
  drop constraint if exists items_colour_source_check;

alter table public.items
  add constraint items_colour_source_check
  check (colour_source in ('measured', 'spoken', 'catalogue'));

comment on column public.items.colour_source is
  'Where this garment''s colour came from. ''measured'' is OKLCH computed from the user''s own photograph. ''spoken'' is a word resolved through the lexicon in src/lib/color. ''catalogue'' is the merchant''s own colour name for their product photograph — which is neither: the pixels are a studio shot of a different physical garment, so the harmony scoring must not treat it as ground truth.';

-- 3 · How the garment got here ---------------------------------------------
--
-- `intake_method` has been ('photo','voice','manual') since 20260810140200, and
-- its stated purpose is "the analytics cut that answers whether voice intake
-- worked". A catalogue import is none of the three. It is not 'photo' — nobody
-- photographed anything; the whole point of the matcher is that the user did
-- not have to. It is not 'voice' — a typed query is explicitly NOT voice, and
-- filing it there would corrupt the one number this column exists to produce.
-- It is not 'manual' — that is the typed-words escape hatch in
-- `useFileTypedWords`, where the user describes the garment themselves and no
-- catalogue was consulted at all.
--
-- Left as 'photo' (the default), a catalogue import would be counted as camera
-- intake, which makes the analytics cut wrong in exactly the direction that
-- hides the thing it is measuring.
--
-- Same drop-then-add pairing as above, for the same replay reason.

alter table public.items
  drop constraint if exists items_intake_method_check;

alter table public.items
  add constraint items_intake_method_check
  check (intake_method in ('photo', 'voice', 'manual', 'catalogue'));

comment on column public.items.intake_method is
  'How the garment got here. ''photo'' is a camera or library upload, ''voice'' is a spoken intake session, ''manual'' is the typed-words escape hatch, ''catalogue'' is a licensed listing the user matched and imported. The analytics cut that answers whether each intake route worked. Rows imported from a listing before 2026-08-13 still say ''photo'' and are not backfilled: nothing recorded at the time distinguishes them from a camera upload, so relabelling them would be a guess dressed as provenance.';

-- 4 · The preflight ---------------------------------------------------------

/**
 * How much room is left, by the same two counts the trigger enforces.
 *
 * `security definer` because `item_limit_for_plan` and `effective_plan` have
 * been revoked from client roles since 20260805220000, and re-granting them to
 * answer this would hand every client the whole plan-limit surface to read one
 * number from.
 *
 * NO PARAMETER, deliberately. The subject is `auth.uid()` and nothing else, so
 * there is no argument through which one account can ask about another — the
 * shape of question this function simply cannot be made to answer.
 */
create or replace function public.import_capacity()
returns table (active integer, active_limit integer, total integer, total_limit integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.subscription_plan;
begin
  -- No caller, no answer. Returning zeros would read as "an empty closet",
  -- which is a different and much more encouraging thing to be wrong about.
  if v_user is null then
    return;
  end if;

  v_plan := public.effective_plan(v_user);

  return query
    select
      count(*) filter (where not i.is_archived)::integer,
      public.item_limit_for_plan(v_plan),
      count(*)::integer,
      public.item_total_limit_for_plan(v_plan)
    from public.items i
    where i.user_id = v_user;
end;
$$;

-- The house pattern from 20260805220000: nothing is executable by default, and
-- the one role that needs it is named. `service_role` retains execute through
-- its own grants, which is how the Edge Function reaches it on behalf of a
-- caller whose JWT it is already carrying.
revoke execute on function public.import_capacity() from public, anon;
grant execute on function public.import_capacity() to authenticated;

comment on function public.import_capacity() is
  'Active and total garment counts for the calling user, with the ceilings their plan allows. A PREFLIGHT for the batch catalogue import, never an authority: items_enforce_limit remains the only thing that decides whether a row may exist.';
