# P0 — "Garment photography is absent throughout the signed-in product"

Date: 2026-09-02
Device: iOS Simulator "Cinch iPhone 17 Pro" (A568B04E-22DF-49CF-B2F3-55C3449FEB81), keyed Release build
Account observed: greeted "fay"
Scope: read-only audit of `src/` and `supabase/`; no source edited.

## Verdict

**The observed P0 is a QA-fixture data defect, not a product regression. Real users are
not affected by it.** The account on the simulator holds ten item rows whose
`image_path` / `thumb_path` point into *another user's* storage prefix, so every
signing request for those paths is refused by storage RLS and every garment well
in the app falls back to its placeholder. Names load because names come from
`items` (row RLS by `user_id`, which is correct); pictures do not, because they
come from `storage.objects` (path RLS by folder, which the seeded rows violate).

A **separate, smaller, genuinely user-facing bug** was found alongside it: three
call sites drop `thumbPath` from the resolve chain, so a real item that has a
thumbnail but no plate/cutout yet renders as a blank card there. That affects
43 live items across 6 real users today. Fix is three one-line changes.

## 1. Root cause of the observed blank tiles

The signed-in account is `aa6359d8-b57c-4668-89fe-b1681a9df732`
(`simtestf31@cinchstyle.com`, `raw_user_meta_data.full_name = "fay"` — which is
exactly what `useFirstName()` in `src/app/(tabs)/index.tsx:216` reads for the
greeting). Corroborated on device by
`Library/Application Support/com.nelsonsaenz.cinch/RCTAsyncLocalStorage_V1/manifest.json`,
whose `cinch.aliasReconciledFor` key carries that same uuid.

All ten of its items were seeded by copying rows from the `sim-test@cinchstyle.com`
closet **without copying the storage objects**:

```
select count(*) total,
       count(*) filter (where split_part(thumb_path,'/',1) = user_id::text) thumb_owned,
       count(*) filter (where split_part(image_path,'/',1) = user_id::text) orig_owned
from items where user_id = 'aa6359d8-…';
-- total 10 | thumb_owned 0 | orig_owned 0
```

Every path reads `195a2399-3549-4d52-99dc-2c69350730cb/<item>/thumb.jpg` — the
*other* account's folder. There are **zero** objects under
`garments/aa6359d8-…/`.

Storage policy (`pg_policy` on `storage.objects`):

- `garments: owner can read` — `(storage.foldername(name))[1] = auth.uid()::text` → **denies**, first segment is `195a2399…`, `auth.uid()` is `aa6359d8…`.
- `garments: friends read derivatives` / `event co-members` / `published derivatives` — all require a friendship, an event post, or `is_public`; none apply here.

So `supabase.storage.from('garments').createSignedUrls(paths, 3600)` in
`src/features/closet/use-image-urls.ts:42-44` gets a per-path failure for every
path, the entry is skipped at line 52, and `resolve()` (line 62-67) returns
`undefined` for every candidate — it only returns a URL for a path that is
present in the batch's result map.

**Proof this is a signing refusal and not a fetch failure:** every referenced
object physically exists (`thumb_object_missing = 0`, `plate_object_missing = 0`
across all 340 items with a thumb path). A signed URL, once issued, bypasses RLS
for its lifetime — so if signing had succeeded the bytes would have rendered.
They did not render, therefore signing was refused.

### Why the screens look the way they do

With `resolve()` returning `undefined` everywhere, each surface draws its own
"no photograph" mark, and they differ:

| Surface | Component | What is drawn |
|---|---|---|
| Today plate | `src/components/today/today-plate.tsx:161,192` | `PiecePlaceholder` (`today-plate.tsx:56`) — a bare `bg-tray` rounded rect with a hairline. **No text, no glyph** — this is the "empty tile" in the report. |
| Closet grid | `src/components/closet/closet-grid.tsx:133` → `item-card.tsx` | the considered mark (t-shirt glyph). |
| Closet rails | `src/app/(tabs)/closet.tsx:864, 909` → `rail-card.tsx` | same glyph. |
| Plate grid (`ComposedLook`) | `src/components/today/plate.tsx:221` → `GarmentCell` | colour swatch + subcategory text. |

The screenshots taken (`p0/01-today.png`, `02-closet.png`, `03/04-closet-grid.png`)
match exactly: Today shows four featureless rounded rects under a real
"Quiet Texture" name and credit line; Closet shows glyph placeholders in
Most worn, in the 3-up grid, and in Latest pieces. Contrast-stretching the Today
tiles (`05-tiles-contrast.png`) confirms they are uniform — no swatch, no text —
i.e. `PiecePlaceholder`, i.e. `uri === undefined`.

Note the closet **grid** (`closet-grid.tsx:133`) *does* ask for `thumbPath` and is
still blank, which rules out "the tile requested a path that was never signed" as
the cause on this device. The batch itself yields nothing.

### Blast radius of the fixture defect

```
select count(*) from items
where thumb_path is not null and split_part(thumb_path,'/',1) <> user_id::text;
-- 20 rows, 2 users
```

Both are QA accounts created 2026-09-01:

| user | email | full_name | bad items |
|---|---|---|---|
| `aa6359d8-…` | simtestf31@cinchstyle.com | fay | 10 |
| `4b827726-…` | sim-test+j00@cinchstyle.com | journey | 10 |

**No real user has a cross-prefix path.** 397 items total; `foreign_cutout` and
`foreign_plate` are both 0.

### Remediation for the fixture (data, not code)

Either re-seed those two closets by uploading real objects under their own
`{user_id}/{item_id}/` prefixes, or copy the 20 objects from the `195a2399…`
prefix into each account's prefix and rewrite the paths. Do **not** widen the
storage policy — the current policy is correct and is the thing that caught this.

## 2. The real product bug found alongside it

`resolve()` is first-hit-wins over the argument order it is handed. Three call
sites omit `thumbPath` from that order, so an item that has a thumbnail but no
plate and no cutout resolves to `undefined` and draws a placeholder even though a
perfectly good picture exists and *is already signed* in the same batch:

- `src/app/(tabs)/closet.tsx:864` — Most worn rail
- `src/app/(tabs)/closet.tsx:909` — Latest pieces rail
- `src/features/plan/packing-trip.tsx:946` — the packing "bag" tiles

All three sign `thumbPath` already
(`src/features/closet/use-closet-screen.ts:152-154`,
`src/features/plan/packing-trip.tsx:445`), so adding it to the resolve order
costs **no extra request** — it is purely a missing fallback argument.

### Who this hits

```
select count(*) items, count(distinct user_id) users from items
where not is_archived and thumb_path is not null and plate_path is null
  and split_part(thumb_path,'/',1) = user_id::text;
-- 43 items, 6 users
```

43 real items across 6 real users are thumb-only today. The Most worn rail is
gated on `wearCount > 0` and most of these have zero wears, but **Latest pieces**
is a plain recency prefix (`use-closet-screen.ts`, `latestPieces = items.slice(0, N)`),
so any user whose newest piece has not been cut out yet sees a blank card in
Latest pieces while the very same piece renders correctly in the grid below it.

### How often does a real device fail to produce a plate?

PostHog `cutout_result`, last 60 days, by outcome / `$app_build` / `$is_emulator`:

| outcome | devices | events |
|---|---|---|
| `ok` | real | 554 |
| `no-subject` | real | 25 |
| `unsupported-device` | **emulator only** | 23 |
| `failed` | — | 0 |

So real hardware succeeds ~96% of the time; `unsupported-device` never appears on
a physical device — it is exclusively the Simulator, which is why QA closets never
get plates and why the thumb fallback matters more in QA than in production. The
25 `no-subject` results are the production thumb-only tail counted above.

## 3. The exact fix

Minimal, three lines, no new requests:

```diff
- src/app/(tabs)/closet.tsx:864
-   imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath)}
+   imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath)}

- src/app/(tabs)/closet.tsx:909
-   imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath)}
+   imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath)}

- src/features/plan/packing-trip.tsx:946
-   uri={resolve(piece.garment.platePath, piece.garment.cutoutPath)}
+   uri={resolve(piece.garment.platePath, piece.garment.cutoutPath, piece.garment.thumbPath)}
```

This is the same order `src/components/closet/closet-grid.tsx:123-137` already
documents and applies: white-ground first, raw camera frame last, kept because
"a piece with no cutout yet must still appear".

### What NOT to change

- **`stackRegime()` (`src/components/today/garment-cell.tsx:172-179`) is not the cause and needs no change.** Today does not use the stack any more — the Today card is `TodayPlate` (`today-plate.tsx`) and the plate grid is `ComposedLook` (`plate.tsx:127`). Its two live consumers already fall back per piece inside the tile regime: `src/components/event-outfits/OutfitPostCard.tsx:149` resolves `cutout → thumb`, and `src/app/repeat-outfit.tsx:196` resolves `cutout → thumb`. The all-or-nothing regime choice is a composition decision (opaque tiles cannot be layered like cutouts), not a blanking bug.
- **Storage policies.** They behaved correctly; loosening them to make the fixture work would leak one user's photographs to another.
- **`use-image-urls.ts`.** `resolve()` returning `undefined` for a path outside the batch is correct — the caller's job is to pass every candidate it is willing to show, and the two closet rails were not doing that.

### Worth doing after the fix

`GarmentImage` deliberately does not log (`garment-image.tsx:35-42` — a signed URL
is a bearer credential). That is right, but it means a wholesale signing refusal is
invisible: this investigation needed a database query to see it. Consider counting
*signing failures per batch* (a count, never a path or a URL) in
`use-image-urls.ts` around line 49-53 and reporting it as an analytics event, so
"nobody's pictures resolved" is a metric rather than a screenshot.
