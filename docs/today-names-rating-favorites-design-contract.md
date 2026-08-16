# Cinch Today names, ratings, and favorites contract

Status: **Design accepted except the founder decisions in “Approval gate”**  
Version: v1 · 2026-08-16  
Source revision: `2bfbf5c` on `codex/today-polish`

## Product truth

Today exists to remove the morning outfit decision: three useful outfits from
clothes the person already owns. Names should make those outfits feel finished
without exposing model reasoning. Logging a wear should remain quick and
honest. Ratings and favorites are private learning inputs, not social proof and
not a second Saved/Boards system.

Non-goals:

- no AI call is required for an ordinary morning;
- no public or friend-visible favorite state;
- no repurposing of legacy `outfits.rating` or `saved_at`;
- no offline queue or promise that an interrupted write will eventually land;
- no new vendor, permission, dependency, native module, paywall, or release
  behavior.

## Experience principles

1. The outfit is the artifact. Its name, composition, and garment credits carry
   the card; explanatory prose does not.
2. Wearing is the primary action. Rating and favoriting are optional details in
   one confirmation step, never prerequisites.
3. Skipping feedback is a real path. It records a wear and no rating.
4. Favorites remain suitable suggestions, not hard-pinned recommendations.
5. Every unavailable or failed action says what happened and offers only a
   recovery the app can actually perform.

## Screen and state contract

### TN-01 — Today, names only

- Keep the existing three-card hierarchy, garment composition, garment credits,
  palette, cost-per-wear, repeat treatment, and actions.
- Show one deterministic 2–4-word editorial outfit name.
- Remove the visible reasoning paragraph and its skeleton space from every
  Today state. Keep reasoning in the internal candidate/persistence pipeline.
- Names must be grounded only in known candidate/context facts. They may evoke
  palette, silhouette, layering, formality, weather suitability, pattern, or
  texture, but may not invent a brand, fabric, destination, mood, or event.
- The same outfit core, day, and context fingerprint keeps the same name across
  rerenders. The three visible cards must not share a name.
- Existing authorized AI-enhancement branches may refine wording after local
  selection. Empty, generic, longer-than-four-word, duplicate, or ungrounded AI
  names fall back locally and may never reorder cards.

States:

- local ready: deterministic name is present immediately;
- AI enhancing: local name stays visible; no loading copy replaces it;
- AI accepted: only the words may change, before user interaction;
- AI rejected/late/offline: local name remains;
- AX5: name wraps without clipping and the garment composition remains reachable;
- Reduce Motion: no rename animation; a valid local name is stable.

### WR-01 — Wear confirmation sheet

Trigger: tap `I wore this` on a non-worn Today card.

Hierarchy:

1. Title: `Log this outfit?`
2. Compact outfit identity: accepted name plus garment thumbnails/credits.
3. Optional rating control.
4. Explicit `Favorite outfit` switch/control with text label and non-color
   selected state.
5. Primary action: `Log this outfit`.
6. Secondary action: `Cancel`.

Behavior:

- The initial rating is unrated; no score is preselected.
- Cancel writes nothing and returns focus to `I wore this`.
- The primary action commits the wear, accepted displayed name, optional rating,
  and explicit favorite state in one idempotent transaction.
- While committing, controls remain readable and become unavailable; the primary
  action shows bounded progress and cannot double-submit.
- Success dismisses the sheet and uses the existing `Worn today`/undo surface.
- Failure keeps the selections in the mounted sheet and maps the same honest
  signed-out, offline, validation, and server categories already used by Phase A.
- Retry reuses the same mounted operation ID. App termination is not described as
  recoverable.

Accessibility:

- Sheet title receives initial focus.
- Rating choices expose `1 out of 5` through `5 out of 5`, selected state, and a
  visible alternative to any gesture.
- Favorite exposes role, label, and selected state; it is never communicated by
  oxblood alone.
- Cancel is leading and Log is trailing where native sheet conventions apply.
- AX5 scrolls; the primary and cancel actions remain reachable above the safe
  area and keyboard.

### FV-01 — Owner-private Favorite outfits rail

Location: Closet, below the compact identity/stats block and primary closet grid
entry point, not above clothing.

- Title: `Favorite outfits`.
- Show only outfits explicitly favorited by the signed-in owner.
- Reuse the existing look/plate visual language and detail route; do not create a
  second Saved/Boards model.
- A card shows the persisted outfit name, garment composition, and last worn
  date when known. No social counts, public badge, or friend visibility.
- Empty state is absent rather than a promotional card. The rail appears after
  the first favorite exists.
- Failed media uses the existing resilient garment/media treatment.
- At AX5, cards and the rail title wrap/reflow without horizontal clipping.

### FV-02 — Favorite detail and removal

- Existing owner outfit/detail surfaces show the favorite state as an explicit
  control.
- Removing a favorite uses SET semantics and does not delete the wear, decrement
  garment wear counts, or remove a separately kept/Saved plate.
- A recoverable failure remains inline or uses the shared non-blocking feedback
  pattern. Destructive alerts are not used because unfavoriting is reversible.

## Deterministic name system

The local library contains 50–100 unique, human-written names, each 2–4 words.
Each entry declares one or more grounded tag families:

- occasion/formality;
- warmth/weather suitability;
- palette harmony/contrast;
- silhouette/layering;
- garment-category composition;
- pattern/texture intensity.

Selection rules:

1. Derive tags only from the existing candidate and style-context model.
2. Filter to compatible entries; score exact tag overlap before broad fallback.
3. Tie-break with a stable hash of sorted item IDs, calendar day, and the same
   context fingerprint used by the styling result.
4. Reserve already-used names while naming the visible set.
5. Fall back to a neutral grounded name, never weather prose or `From your
   closet`.

## Privacy and data contract

The implementation contract is additive:

- `outfits.wear_rating smallint null check (wear_rating between 1 and 5)`;
- `outfits.favorited_at timestamptz null`;
- existing `outfits.rating` remains legacy binary taste semantics;
- existing `saved_at` remains Saved/Boards semantics;
- owner-only table policies remain authoritative; no social view, RPC, or event
  exposes the new fields;
- `wear_outfit_tx` receives defaulted/backward-compatible rating, favorite, and
  accepted-name arguments and commits them with the existing wear atomically;
- favorite updates use explicit desired state, not toggle semantics;
- production migration/deployment is outside this contract.

No raw outfit name, rating, favorite status, identity, transcript, or garment
list is added to analytics. Existing bounded success/failure events may record
only categorical presence (`rated`, `favorited`) if the current event dictionary
and privacy review explicitly allow it.

## Learning contract

Recommended policy, pending founder approval:

- favorite: strongest positive signal for the exact outfit core;
- 4–5: positive;
- 3: neutral;
- 1–2: negative;
- an explicit rating overrides the current implicit assumption that a wear is a
  positive taste signal;
- an unrated wear remains a wear/freshness fact and does not invent a taste score;
- favorites may receive a bounded exact-core ranking bonus but weather,
  occasion, freshness, and diversity constraints always win.

## Acceptance matrix

- Name library has 50–100 unique entries; every name is 2–4 words.
- Same item IDs/day/context produce the same name.
- Three-card output has no duplicate names and every tag family is reachable.
- Ordinary mornings still perform zero AI calls.
- Late/rejected AI wording never reorders or blanks cards.
- Today shows names and garment credits but no reasoning or rationale skeleton.
- Wear persists the displayed name.
- Unrated, each rating, favorite on/off, cancel, busy, success, categorized
  failure, and same-mounted retry are covered.
- Atomic database tests prove item wear counts, outfit row, item links, name,
  rating, and favorite commit or roll back together.
- RLS tests prove another user cannot read or change rating/favorite fields.
- Favorite rail is owner-only, absent when empty, and independent from Saved and
  Most worn.
- Normal, AX5, VoiceOver, Reduce Motion, offline, response-lost, clean-account,
  and returning-account states receive independent QA evidence.

## Approval gate

Founder approval is required before schema/RPC/client implementation. Approving
this contract accepts these choices:

1. unrated plus 1–5; no selectable zero;
2. favorites owner-private only;
3. one `Favorite outfits` rail in Closet, reusing existing detail paths;
4. the learning policy above;
5. additive local migration/RPC work, with no production application;
6. online-only launch behavior with honest retry copy and no durable outbox.

## Implementation order after approval

1. Deterministic local name library/selector, Today presentation, and name
   persistence tests.
2. Additive local migration, pgTAP/RLS tests, backward-compatible RPC arguments,
   and regenerated types.
3. Wear confirmation sheet and mutation wiring behind a local feature flag.
4. Owner-private favorite query, Closet rail, detail control, and cache updates.
5. Full automated checks and independent simulator/accessibility acceptance.

