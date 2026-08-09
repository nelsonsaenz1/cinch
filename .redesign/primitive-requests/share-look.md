# Primitive requests — Unit F, Share a Look

Things the shared, read-only layers (`src/theme/**`, `tailwind.config.js`,
`src/components/look/**`, `src/features/event-outfits/look-layout.ts`,
`src/features/closet/outfit-count.ts`, `src/lib/styling/**`) don't currently
provide, what I needed them for, and what I did instead without touching them.

## Nothing was blocked

`LookPlate` (`src/components/look/look-plate.tsx`) and `lookCells`/
`lookColumns` (`look-layout.ts`) covered every composed-plate need this flow
has — the S-02 stack preview, the S-03 mini-thumb at 96pt, the S-04
illustrated card, and the dev route's fixtures all consume `LookPlate`
directly at whatever width they need, exactly as the shared layer's own
docblock promises ("one object, four sizes"). No re-composition, no forked
arithmetic. This file exists per the hard rules even though it has no asks in
it, so the next unit reading `.redesign/primitive-requests/` doesn't have to
guess whether Unit F looked.

## One near-miss, resolved without touching the shared layer

**Need (almost):** the atlas's rule "Cover is only used for a plain photo
post, which is marked as one" implies `LookPlate`/`GarmentCell` would need a
`cover`-fit rendering mode for the S-05 "Post a photo instead" escape hatch.

**What I did instead:** I did not build that escape hatch at all — see
`.redesign/escalations.md`. Since the feature it would serve doesn't exist,
no `cover`-fit primitive was requested. If "Post a photo instead" is ever
built for real, this is the first thing its author will need from the plate
grammar, and it belongs in `look-plate.tsx`, not reimplemented per-caller.

## One shared-primitive gap I worked around locally, not in the shared layer

`Button` (`src/components/ui/button.tsx`, not in the read-only list but a
de-facto shared primitive with ~90 call sites) has no destructive variant and
structurally omits `style` from its props (`Omit<PressableProps, 'children' |
'style'>`), so the S-05 "Take it off" fill (`theme.critical`, `#8A2E28` —
already a token, just never spent on a button ground) couldn't be reached
through it. `DestructiveButton` in
`src/components/share-look/edge-states.tsx` hand-builds the same
press-feedback shape `Button` and `SelectionBar`'s `BarButton` both use,
rather than patching `Button` itself. If a second surface ever needs a
destructive fill, `Button` growing a `variant="destructive"` is a five-line
change and would let both call sites delete their hand-rolled copies.
