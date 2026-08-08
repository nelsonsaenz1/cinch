# Primitive requests — Unit A (The Ten / The Reveal)

Nothing here blocked the build. Two places wanted something the read-only
layer doesn't have; both got a local workaround instead, recorded here per
the worktree's rule.

## 1. A dark-ground text ramp

The Reveal's beats (R-01, R-02, R-04, R-05) run on `ink`, not `canvas` — the
one screen in this wave besides the camera that isn't light-only. `theme.ts`
has no muted/faint equivalent for a dark ground (`muted`/`faint`/`byline`/
`ghost` are all tuned against `canvas`), so there is no token for "the
secondary line under a headline, when the headline is white on black."

**What I did instead**: `canvasAlpha(x)` in `src/components/reveal/reveal-
stage.tsx` — `rgba(251,250,246,x)`, i.e. the `canvas` token composited over
`ink` at a given opacity, the same move `scrim` already makes in the other
direction (`ink` at 40% over `canvas`). `capture.tsx`'s live-preview hint
text does the identical thing today with a hand-typed literal
(`rgba(251,250,246,.75)`), so this isn't a new pattern — I gave it one name
in one place instead of a fourth hand-rolled copy.

**Would be better as**: a `theme.canvasOn` ramp (or similar) if a second dark
surface ever ships. Not requesting it now — one file needing it twice
(reveal + camera) doesn't justify widening the token surface, and the
read-only note says implement-and-continue, not block-and-ask.

## 2. A "recommended redirect" judgment call — not a primitive, but adjacent

T-04's substitution sheet highlights "a fourth top instead" over "a third
bottom instead" even though the bottom option counts higher (18 vs 16). The
atlas is explicit that this is not arithmetic ("the recommended option stays
recommended because the engine builds better outfits from it, not because it
scores higher") — and there is no such signal anywhere in `src/lib/styling/`
to read that judgment from. `score.ts` ranks candidates for a *specific*
closet; it has no notion of "which hypothetical addition improves outfit
QUALITY, not just count."

This isn't asking for a change to the read-only styling engine — a "closet
completion quality" score is a real feature, not a two-line addition, and
guessing at its shape here would be worse than admitting there's no signal.
Documented the choice as an editorial table instead: see `REDIRECT_TARGETS`
in `src/features/onboarding/ten-slots.ts`. Flagging it here so whoever
eventually designs that signal knows this is where it would plug in.
