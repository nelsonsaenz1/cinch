# Primitive requests — Unit K, saved plates & boards (atlas 35)

Things the shared and other-unit layers don't currently provide, what I needed
them for, and what I did instead without touching them. Ordered by how much of
the atlas is unreachable without them.

## 1 · Nothing raises the Keep sheet, because no plate surface is mine

**Need:** KP-04's own trigger — "raised from any plate". The sheet is where a
look enters the collection at all, so without a caller, atlas 35's entry point
does not exist in the shipping app: every other state can only be reached by a
plate that is somehow already kept.

**Which state:** KP-04, and by extension KP-01/03, which have nothing in them
until something is kept.

**What I did instead:** The sheet is built, exported and reachable in
`dev-saved.tsx` in both of its modes. `src/app/saved.tsx` and
`src/app/board/[id].tsx` raise it in `move` mode over an already-kept plate,
which is the atlas's other stated use ("moving it is one tap in the same sheet
that saved it"), so the component is genuinely exercised — but the `keep` mode
and `KeepTarget = { kind: 'look', itemIds }` ship unwired.

**What closes it** — one handler on whichever screen shows a plate
(`src/app/(tabs)/index.tsx`, the plate card, or the repeat/reveal surfaces):

```tsx
const [keeping, setKeeping] = useState<string[] | null>(null);
// …
<KeepSheet
  visible={keeping !== null}
  mode="keep"
  boards={lookbook.sheetBoards}
  selectedBoardId={boardId}
  onSelectBoard={setBoardId}
  onCreateBoard={(name) => createBoard.mutate({ name }, { onSuccess: setBoardId })}
  onCommit={() => keepPlate.mutate({ target: { kind: 'look', itemIds: keeping! }, boardId })}
  onDismiss={() => setKeeping(null)}
/>
```

`useLookbook()`, `useKeepPlate()` and `useCreateBoard()` are all exported from
`src/features/boards/` and take no arguments beyond the above.

## 2 · "Send to Packing" has no seam to hand a board through

**Need:** The integrator's decision, verbatim: *a dated board prefills the
existing packing questionnaire with its dates and its pieces*. Packing lives
inside `src/app/(tabs)/plan.tsx`, whose mode is `useState<Mode>('week')` and
which reads no search params; the questionnaire's own run lives in a
module-level slot inside `src/features/plan/use-trip-questionnaire.ts`, whose
only seeding seam is `__DEV__`-gated. Both files belong to other units.

**Which state:** KP-03, the dated board.

**What I did instead:** Built my half.
`src/features/boards/packing-handoff.ts` holds one pending offer — the board's
id and name, both dates, and its **distinct** pieces — and the board page
stashes it and navigates to Plan. No packing list is produced and no
questionnaire is skipped: the offer is dates and pieces, and the questionnaire
still asks where, who with and what kind of thing it is, because that is what
produces the brief. The Pro gate is untouched and un-duplicated —
`usePackingAccess` is still the only boundary, and a free account meets the
same locked plate it would meet from the Plan tab.

**What closes it** — two lines in `PlanScreen`:

```ts
const handoff = takeBoardPackingHandoff();      // features/boards/packing-handoff
if (handoff) { setMode('packing'); /* seed the questionnaire's dates */ }
```

plus a non-dev seeding path in `useTripQuestionnaire` (the `devSeed` parameter
already there is the exact shape; it needs its `__DEV__` guard relaxed, or a
sibling `seed` that only fills `startsOn`/`endsOn`).

**Until then** the button lands the reader on Plan, one tap from Packing, with
nothing prefilled. That is short of what the atlas promises and is reported as
such rather than dressed up.

## 3 · Nothing writes `origin_outfit_id`, so every kept plate reads "never worn"

**Need:** KP-01's "Monday standard · worn 6×". The contract fixes the formula:
`count(*) from outfits where origin_outfit_id = <plate> and worn_at is not
null`. The read side is built and correct. The write side is
`wear_outfit_tx(… p_origin …)`, and the only caller of that command is
`src/features/styling/mutations.ts` — another unit's file — which still passes
six arguments.

**Which state:** KP-01 and KP-03's meta lines.

**What I did instead:** Nothing, deliberately, because the alternative is a
lie. A kept plate whose descendants are zero **is** "never worn", and the
migration says as much ("a kept plate made from them starts its count at
whatever it has actually been worn since"). The count is never estimated from
`items.wear_count`, never borrowed from the plate's own `worn_at`, and a failed
count throws rather than falling back to zero — `queries.ts` is explicit about
that, since "never worn" is a claim about somebody's history.

**What closes it:** pass the plate id as `p_origin` from whatever "wear this
again" ends up being. One argument.

## 4 · Keeping an unsaved look is two writes, not one

**Need:** A look that has never been an `outfits` row — Today's proposal —
becomes one when it is kept. `wear_outfit_tx` always marks the outfit worn;
`plan_outfit_tx` always writes a calendar entry. Keeping is neither, and there
is no `keep_outfit_tx`.

**What I did instead:** `createOutfit` in `src/features/boards/mutations.ts`
inserts the outfit and then its items, following the precedent
`createOutfitWithoutWear` in `share-look/mutations.ts` set for the same reason.
The exposure is a kept look with no pieces if the connection drops between the
two statements — visible as an empty tile, correctable by keeping again.

**What closes it:** a `keep_outfit_tx(p_op_id, p_item_ids, p_name, p_board_id)`
alongside the other two commands, and a `'keep_outfit_tx'` member on
`CommandName` in `src/lib/commands.ts`. Migrations are Phase 1's.

## 5 · `PlateTile` has no radius (shared layer, read-only)

**Need:** The tile fills the top of a `rounded-lg` card. `PlateTile` rounds its
own corners at a fixed 6, so a bare tile inside a 16-radius card shows four
slivers of card colour where the two radii disagree.

**What I did instead:** `PlateCard` paints a `tray`-coloured box behind the
tile, so whatever the rounding reveals is the tile's own ground and the seam
disappears. One extra view per card.

**What closes it:** an optional `radius?: number` on `PlateTile`, defaulting to
6. Two lines, and it removes the wrapper here and any future one.

## 6 · `AppEvent` is a closed union, so these writes are untracked

**Need:** The four events worth having off this atlas — a plate kept (and
whether it landed on a board), a plate removed, a board created (and whether it
is dated), a board deleted. `AppEvent` in `src/lib/posthog.tsx` is a closed
union in the shared layer.

**What I did instead:** No tracking at all, rather than a string cast past the
union. `mutations.ts` says so at the call site so it is not mistaken for an
oversight.

**What closes it:** four members on `AppEvent`: `plate_kept`, `plate_removed`,
`board_created`, `board_deleted`.
