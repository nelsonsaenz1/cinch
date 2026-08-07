# Share card atlas

Source of truth: `Share Card.dc.html` (states SC-01, SC-02, renderings in
`renderings/`). This atlas specifies the 1080×1920 PNG the app renders
off-screen and hands straight to the iOS share sheet — the outfit's name,
its garments, its palette, and the Cinch colophon on the same paper ground
the app is printed on.

**Implemented by**: `src/components/share/plate-card.tsx` (the card),
`src/features/share/card-layout.ts` (its slot geometry and type rules),
`src/features/share/capture-plate.ts` (the capture + share sheet), and
`src/components/today/plate.tsx` (the long-press trigger and the failure
state).

## Rules the render enforces

Transcribed from the atlas's own "Rules the render enforces" card:

1. **No weather, no colophon.** `weather === null` removes the line; it is
   never estimated.
2. **No missing photographs.** A garment without a plate falls back to its
   swatch, same as everywhere else — the card never ships an empty tile.
3. **No name, no card.** An unnamed outfit cannot be shared; the share
   action stays disabled until the stylist has named it.
4. **No price.** Cost-per-wear is yours. It appears on the plate in the app
   and nowhere on the artifact that leaves the phone.
5. **No faces, no location, no handle.** Nothing on the card identifies who
   made it.

## Documented deviation

The atlas's signature line reads "CLOTHES SHE ALREADY OWNS." The
implementation sets "CLOTHES YOU ALREADY OWN" instead. `docs/design-directive.md`
states the product's brand line as "a personal stylist for the clothes you
already own" — second person — and the card is seen by people who are not
the user it was made for.
