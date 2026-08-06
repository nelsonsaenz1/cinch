# App Store screenshots — directive for the ASC Agent

Five finished marketing screenshots for Cinch's App Store listing, ready to
upload to App Store Connect. This document is the handoff: what each file is,
the order they go in, where every photograph came from, and what not to do
with them.

## The files, in upload order

All five are **exactly 1290 × 2796 px** PNG, portrait — Apple's 6.9-inch
iPhone display size (iPhone 16 Pro Max class). This one set satisfies the
current iPhone screenshot requirement; smaller sizes scale down from it
automatically in App Store Connect.

| # | File | App screen depicted | Headline on the frame |
|---|---|---|---|
| 1 | `docs/app-store/screenshots/01-today.png` | **Today** tab — the daily outfit plate ("The Long Lunch"), weather + plans context, palette and $/wear footer, Love it / Not for me / I wore this actions, the honest "Learning from 12 reactions" line | "Dressed in a *minute.*" — subline: "Every morning: outfits built from your own closet, chosen for the day's weather, plans, and your taste." |
| 2 | `docs/app-store/screenshots/02-event.png` | **Event detail** — "Dana's birthday dinner": the blush YOUR LOOK card with picks from the table, the WHO'S WEARING WHAT grid, and the stylist's computed group note ("Two of you are in cream…") | "The group chat, *answered.*" — subline: "Post the dinner. Friends pin looks from their own closets, vote — and everyone walks in decided." |
| 3 | `docs/app-store/screenshots/03-closet.png` | **Closet** tab — the profile view: monogram, 54 pieces / 128 outfits / 9 unworn stats, "Averages $4.10 a wear" bio line, favourite-pieces rail, most-worn chart | "You own 54 pieces. *Nine, never worn.*" — subline: "Cinch counts every wear — cost-per-wear, the favourites, the never-worn — so you can see the difference." |
| 4 | `docs/app-store/screenshots/04-stylist.png` | **Stylist** sheet — a two-turn conversation: an outfit recommended from owned clothes (with the garment strip), then the honesty moment ("nothing you own is formal enough for black tie, and I won't invent a gown you don't have") | "A stylist that *never* sells you anything." — subline: "It answers from your real closet — and says so, plainly, when you don't own the right thing." |
| 5 | `docs/app-store/screenshots/05-plan.png` | **Plan** tab — Week mode: seven day rows against the forecast, colour swatches, the "No piece worn more than twice" rule, planned-day checkmarks | "The week, *already decided.*" — subline: "Seven days laid out against the forecast — and no piece worn more than twice." |

The order carries the argument — daily habit first, the social differentiator
second (no competitor has it), then data, honesty, planning. **Do not reorder
the frames.**

## Rules for upload

- **Do not crop, resize, letterbox, or re-encode** these files. Apple requires
  the exact pixel dimensions; they are already exactly 1290 × 2796.
- **Do not reorder** — upload as numbered, 01 through 05.
- **No iPad screenshots exist and none are needed**: the app ships
  `supportsTablet: false` (app.config.ts), so App Store Connect will not ask
  for an iPad set. Do not generate or upload one.
- Do not add App Store Connect's own text overlays or frames on top; the
  frames are finished marketing art (headline + device already composed).
- If a future display-size slot demands a different resolution, come back to
  `docs/app-store/screenshots/src/` and re-render at the new size — never
  stretch these PNGs.

## Licensing provenance

Every garment photograph in these frames comes from
`assets/garments/MANIFEST.md` — all licensed for commercial use with no
attribution requirement, retrieved 2026-08-06. Which photographs appear in
which frame:

| Photograph | Creator · License | Appears in frames |
|---|---|---|
| `cream-mohair-sweater.jpg` | Yuliia Pakhomova (Unsplash) · Unsplash License | 1, 2, 3, 4 |
| `charcoal-tailored-trousers.jpg` | Sasi (Unsplash) · Unsplash License | 1, 2, 3, 4 |
| `brown-leather-loafers.jpg` | Lily Johnson (Unsplash) · Unsplash License | 1, 2, 4 |
| `cognac-leather-tote.jpg` | Ugluk Potroshitel (Unsplash) · Unsplash License | 1, 3 |
| `beige-corduroy-skirt.jpg` | Atlantic Ambience (Pexels) · Pexels License | 2 |
| `brown-leather-boots.jpg` | Zac Wolff (Unsplash) · Unsplash License | 2, 3 |
| `white-linen-blouse.jpg` | dayong tien (Pexels) · Pexels License | 2, 3 |
| `brown-leather-crossbody-bag.jpg` | Muneeb Malhotra (Pexels) · Pexels License | 4 |
| `cognac-shearling-coat.jpg` | Margarita (Pexels) · Pexels License | 3 |

Frame 5 (Plan) uses no photographs — only colour swatches.
`beige-overshirt-jacket.jpg` and `cream-crochet-poncho.jpg` are named in
frame-5 row text but their images do not appear in any frame.

One care note: the full `brown-leather-loafers.jpg` source photo shows a
maker's mark on the insole. Every crop used in these frames is of the toe
only — no brand mark is visible in any rendered screenshot. If the crop is
ever changed, re-check this.

## Content honesty notes (for review defence)

- Every screen depicted exists in the shipping app (`src/app/(tabs)/index.tsx`,
  `src/app/event/[id]/index.tsx`, `src/app/(tabs)/closet.tsx`,
  `src/app/stylist.tsx`, `src/app/(tabs)/plan.tsx`) and the UI grammar —
  tokens, type, copy register — is transcribed from the app's own design
  system (`tailwind.config.js`, `src/theme/tokens.ts`,
  `src/components/ui/text.tsx`).
- The stylist subtitle "Only your clothes — nothing invented" is the app's
  real header string.
- Numbers are internally consistent within each frame (headline "nine never
  worn" = the 9 Unworn stat on screen; "2 of 5 shared" = two boards in the
  grid). No ratings, review quotes, or invented social proof anywhere.

## Rebuilding

Sources live in `docs/app-store/screenshots/src/` (one HTML file per frame +
`base.css`). Render with:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1290,2796 --screenshot=OUT.png "file:///ABS/PATH/frame.html"
```

The HTML references garment images and the Instrument Serif font files by
absolute `file://` path, so re-rendering on another machine requires fixing
those paths first.
