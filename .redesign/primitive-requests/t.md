# Primitive requests — Unit T, the first-run tour

Two things `EditorialFrame` and `Button` don't currently provide, what atlas 36
needed them for, and what the tour does instead without touching either.

## 1 · The headline cannot reach 56px

**Need:** The atlas is unusually precise about this frame's type and says why:
"Headline — Instrument Serif, 56px, line-height 1.04, two or three words a
line. **It is the largest type anywhere in the app.**" That last clause is the
whole point of the tour — three spreads that are visibly bigger than anything
that follows them.

`EditorialFrame` sets the headline with `<Text variant="display" trim>`, and
`display` is 40px (tailwind.config.js). There is no 56px step: `wordmark` is
64 and `display` is 40. The prop is also typed `headline: string`, so a caller
cannot pass a `<Text>` of its own, and `TRIMS.display` is computed for 40px, so
an inline `fontSize: 56` would leave the cap-trim wrong by the difference.

**Which states:** TR-01, TR-02, TR-03 — every frame of the tour.

**What I did instead:** Nothing. The frames ship at `display`'s 40px. Against
the PNGs this is the one departure a reviewer will see immediately: "Your whole
closet, on one page." sets to three lines at 56 and to two at 40, and the
announcement reads a size quieter than the atlas intends.

**The fix, if it is wanted:** a `spread` fontSize token at 56px with a
`leading('instrument', 56, 1.04)` line height and its own `TRIMS` entry, and
`EditorialFrame` switching its headline to it. One token and one word in
`editorial-frame.tsx`. No other screen may use it — the atlas's claim that this
is the largest type in the app is only true if nothing else reaches for it,
which is the same rationing rule the ink ground already lives under.

## 2 · `Button` has no inverse variant for the ink ground

**Need:** TR-01's primary action is a canvas pill with an ink label, on the ink
ground. `Button`'s five variants are oxblood (`primary`), ink, an outline in
`rule`, quiet ink text, and the critical brick. On ink, `ink` disappears,
`secondary`'s outline is invisible, `ghost` is unreadable — and `primary` would
both go oxblood-on-ink (poor contrast) and spend a screen's one accent on a
"Next".

**Which state:** TR-01, the only frame with a ground.

**What I did instead:** `InversePill` in
`src/features/onboarding/tour-frames.tsx` — a `Pressable` with `usePressFeedback`
and inline OBJECT styles only, never a `className` alongside a function `style`,
which renders nothing. It is about twenty lines and it duplicates the shared
Button's press behaviour by importing the same hook, so the two cannot drift on
feel. It will still drift on radius and label colour if `Button` ever changes
either.

**The fix, if it is wanted:** a sixth variant — `inverse`, `backgroundColor:
theme.canvas` with `labelKey: 'ink'`. Four lines in `button.tsx`, and the
work-around above deletes itself.

## Not a request — recorded so it isn't rediscovered

`EditorialFrame`'s `secondary` slot is the only place below the action, so the
three-dot length indicator rides in it (wrapped with the text secondary on
TR-03). That is a use the component didn't anticipate but handles correctly;
no change wanted.
