# 01 · Screen-by-screen visual audit

Read-only pass over every route in `src/app/` against the canon named in
`docs/refurb/CHARTER.md`: `docs/design/field-guide-content.md`, the
pattern distillation in `docs/design/field-guide-audit.md`,
`docs/design-directive.md`, `src/theme/tokens.ts` / `tailwind.config.js`, and
the five approved App Store frames in `docs/app-store/screenshots/` — **whose
HTML sources (`screenshots/src/*.html` + `base.css`) are the most precise
specification the project owns.** Those files transcribe the shipping tokens
into exact pixel values at a 430 × 908 logical frame, so every "approved frame
sets X, the app sets Y" below is a measured comparison, not an impression.

Scope: composition only — hierarchy, type scale, spacing rhythm against
`GUTTER`, alignment, density, card and button treatment, image presentation,
icon consistency, safe-area handling, and the composition of empty / error /
loading states. State *coverage* was already fixed by the six batches in
`field-guide-audit.md` §4 and is verified as landed; what remains is
**adoption**: three shared primitives were built in Batch 1 and then almost
nobody imported them.

Classifications per the charter: `preserve exactly` · `minor polish` ·
`visually refine` · `improve interaction` · `consolidate into component` ·
`fix inconsistency` · `fix friction` · `add missing state` · `reject`.

---

## 0 · The headline finding

`src/components/ui/screen-header.tsx` exports `ScreenHeader` and `BackButton`.
**Zero files import either one.** Nine screens still hand-copy the same
nine-line 36pt disc. `src/components/ui/rule.tsx` exports `Rule`; six files use
it and **fifteen** still write `<View className="h-px bg-hairline" />` inline.
`text.tsx` added `statSmall` and `statFigure` specifically to end the
"`variant="stat"` + an inline `fontSize`" idiom; `statSmall` has **zero**
consumers outside `chip.tsx`, `statFigure` has **one**, and three files still
hand-set the size. The primitives are correct and well-documented. The
refurbishment's single highest-leverage act is to *use* them — it deletes ~140
lines, removes an accessibility guarantee (`hitSlop`) that is invisible when it
goes missing, and it is a pure no-op visually except where it silently fixes
drift.

---

## 1 · Root shell — `src/app/_layout.tsx`

- [add missing state] `src/app/_layout.tsx:172-178` — the session-hydration gate is a bare centred `<ActivityIndicator/>` with no tint and no canvas branding; it is the first frame after the splash on every cold start with a stale session. — Replace with the canvas ground plus the serif wordmark at `variant="wordmark"` trimmed, or at minimum `<ActivityIndicator color={theme.muted}/>` so it is not iOS blue-grey on warm paper. — The handoff from splash to app stops reading as a stall in a different app.
- [minor polish] `src/app/_layout.tsx:239-240` — `ThemeProvider` still switches on `useColorScheme()` and `StatusBar` on `isDark`, in an app pinned to `userInterfaceStyle: 'light'`. Dead branches that imply a second appearance the charter forbids. — Pin both to light and drop `isDark`. — No behaviour change; removes the one place a future edit could accidentally light up a dark path.
- [preserve exactly] `src/app/_layout.tsx:273-282` — the stylist `formSheet` at detents `[0.75, 1]` with `sheetCornerRadius: 38` (the `sheet` token) and a visible grabber. Exactly right, and the 0.75 detent is what makes the conversation read as an aside over Today.
- [fix inconsistency] `src/app/_layout.tsx:283-286` — `profile` is a plain `modal` with `headerShown: false`, and `profile.tsx` draws no close affordance of its own; the only dismissal is the system swipe. `capture` (L260-263) is the same. — Give `profile` `presentation: 'formSheet'` + `sheetGrabberVisible` like stylist, or add a "Done" row. — A modal with no visible way out is the one interaction failure users report as "stuck".

## 2 · Welcome / sign-in — `src/app/(auth)/sign-in.tsx`

The hero is now real garment artwork over Skia grounds with the 180° scrim
(L222-245) — both gaps the previous audit named are closed, and the
composition is the best-looking screen in the app.

- [preserve exactly] `src/app/(auth)/sign-in.tsx:222-245` — `HeroScrim` at `rgba(20,19,17,.5) → 0 → .9`, positions `[0, 0.45, 1]`, above the tiles and below every line of type. Transcribed, correct, and the reason the wordmark survives any garment.
- [fix inconsistency] `src/app/(auth)/sign-in.tsx:545, 562, 612, 629` — every control on this screen is a capsule: `cornerRadius: px(26)` on the Apple button, `borderRadius: px(26)` on "Continue with email", `rounded-full` on the email field, `px(26)` on the send disc. `tailwind.config.js:141-158` rules that `full` on a wider-than-tall labelled control is forbidden and belongs to `md` (12px). This is the app's only capsule-button screen. — Apple's own button must stay a capsule (HIG); bring "Continue with email" to `px(12)` and the field to `rounded-md`, matching every other field in the app, and record the Apple exception in the config note. — One radius language across the app; the first screen stops teaching a grammar the other seventeen contradict.
- [fix friction] `src/app/(auth)/sign-in.tsx:546, 561, 627` — `height: px(50)` (fixed) on the Apple button, the email button and the send disc, while `RNText` inside them scales with Dynamic Type unbounded (only the input got the documented `minHeight` fix at L614). At AX sizes the labels clip inside their own pills. — `minHeight`, not `height`, on all three, matching the fix already made to the field. — The sign-in screen stays usable at the accessibility text sizes Apple tests with.
- [visually refine] `src/app/(auth)/sign-in.tsx:683-701` — the Terms/Privacy line is five sibling `Text` nodes in a `flex-wrap justify-center` row, so the wrap points fall inside the sentence ("… agree to our" / "Terms" on its own line) at anything above the default text size. — One `Text` with nested pressable `Text` children, or `Text` with `onPress` on the two link spans. — The legal line reads as a sentence rather than as scattered fragments.
- [minor polish] `src/app/(auth)/sign-in.tsx:320` — `warmTan = '#D8B7A6'` is a hand-typed literal. It matches the guide, but it is a second warm tan alongside `accentWarm` `#B08A76`, with no token. — Promote to a token (`accentWarmLight`) or reuse `accentWarm`; the palette is locked, so this is a naming change, not a colour change. — The one place the palette lives outside `tokens.ts` stops existing.
- [minor polish] `src/app/(auth)/sign-in.tsx:307-308` — the whole screen scales off `screenW / 300`, so type sizes land at 34 / 29 / 14.5 / 14 / 13 / 10.5 / 9.5 px — none on the 40/28/24/20/17/16/13/11/10 scale, and none tracking a future scale change. Documented and deliberate; leave the geometry, but note that `variant="body"`/`caption` would carry the same values and would follow the scale. — Optional; low priority against the two above.

## 3 · Magic-link callback — `src/app/auth-callback.tsx`

- [add missing state] `src/app/auth-callback.tsx:75` — bare untinted `<ActivityIndicator/>`. This screen is the last thing between a tap in Mail and the app opening. — Canvas ground, the serif wordmark, one `variant="body"` line ("Signing you in…"), and the tinted `Spinner` from `skeleton.tsx:73`. — The moment of highest anxiety in onboarding stops looking like an unhandled route.

## 4 · Tab bar — `src/app/(tabs)/_layout.tsx`

- [preserve exactly] `src/app/(tabs)/_layout.tsx:48-60` — native `NativeTabs`, monochrome ink tint, no `backgroundColor`, `minimizeBehavior="onScrollDown"`, both colours through `dynamic()`. The glass material is worth more than a drawn bar; §5.3 of the previous audit already ruled the drawn bar out. Do not touch.
- [fix inconsistency] `src/app/(tabs)/_layout.tsx:77` vs `src/app/(tabs)/explore.tsx:144` — the tab reads **Explore**; the screen's own display title reads **Lately**; the charter's locked page inventory calls it **Lately**. Three names for one destination. — Settle on "Lately" in the tab label (it is the more editorial word and matches the charter). — A tab whose label matches its page is the difference between a destination and a mystery.
- [minor polish] `src/app/(tabs)/_layout.tsx:56-59` — labels are HelveticaNeue-Medium 11 with no tracking (`NativeTabsLabelStyle` has no `letterSpacing`), while every other 11px label in the app is the tracked `eyebrow`. Already documented in `docs/design-directive.md` as unfixable. — Leave; record as a known platform limit, not a defect.

## 5 · Today — `src/app/(tabs)/index.tsx`, `src/components/today/*`

Measured against `screenshots/src/01-today.html`. This screen is the closest
of the five to its frame; every delta below is a spacing step, not a
composition change.

- [preserve exactly] `src/app/(tabs)/index.tsx:156-191` — the masthead: tracked `eyebrow` day line, 6px, `display` greeting `trim`, and the two 34pt discs (oxblood `sparkles` on a rule outline, `person.fill` on ink) at `marginTop: 2`. Pixel-for-pixel the approved frame (01-today.html L34-47). No change.
- [preserve exactly] `src/components/today/plate.tsx:434-554` — the card grammar: `rounded-plate` on `bg-surface` with `border-rule`, serif `plate` title with the `Feels 72°` colophon on the baseline opposite, `callout` muted reasoning, the stack, the credit line, the ruled palette/`$x.xx / wear` footer. This is the app's signature and it matches the frame exactly.
- [minor polish] `src/components/today/plate.tsx:436` — card padding is `p-4` (16); the approved frame sets `padding: 14px` (01-today.html L62). — Drop to `p-3.5`. — 2pt per side back to the stack, which is the thing the card exists to show.
- [visually refine] `src/app/(tabs)/index.tsx:766` + `:745` — the plans pill sits at `mt-4` (16) and the first plate at `mt-6` (24); the frame sets 12 and 16 (01-today.html L56, L62). Combined with `mb-section` (28) between plates, the page runs about 20pt looser than approved above the fold. — `mt-3` on the pill, `mt-4` on the plate container. — One more line of the first plate's reasoning clears the fold on a 6.1" device.
- [minor polish] `src/components/today/plate.tsx:521` + `:481-483` — the credit line is `mt-3` (12) and the footer rule `mt-4` (16) / `pt-3` (12); the frame sets 10 / 12 / 10. — Tighten to `mt-2.5` / `mt-3` / `pt-2.5`. — The footer reads as attached to the card rather than floating under it.
- [minor polish] `src/components/today/plate.tsx:482` — garment names join on `'  ·  '` (two spaces each side); the frame uses `&nbsp;·&nbsp;` (one). — Single spaces. — The credit line fits four garments on one line more often before `numberOfLines={2}` truncates.
- [improve interaction] `src/components/today/reaction-bar.tsx:152-173` — once a reaction lands, the two-pill row collapses to **one** `flex-1` pill plus a caption line beneath it, while `WearButton` stays `flex-none` at its old width and the parent row is `items-start`. The card's action row changes both its width distribution and its height on tap. — Keep the row's height and the two-slot geometry stable: render the recorded choice in the same slot at the same width and put the status line inside the fixed footer height (or fade the unchosen pill to 0 opacity rather than unmounting it). — The card stops jumping under the thumb at the exact moment the user is being told their tap registered.
- [improve interaction] `src/components/today/reaction-bar.tsx:176-201` — the "what was wrong with it?" state replaces the row with a seven-chip wrap that grows the card by ~90pt, while `WearButton` remains pinned top-right against `items-start` (`plate.tsx:549`). — Render the reason chooser full-width beneath the action row rather than inside it, and hide `WearButton` while it is open. — The correction flow reads as a step, not as the layout breaking.
- [preserve exactly] `src/app/(tabs)/index.tsx:664-671` — the offline banner: ink pill, 7pt `accentWarm` dot, `label` in canvas. Verbatim from the guide. And `:679` dimming the whole set to `opacity: 0.62` as one block is the right call.
- [preserve exactly] `src/app/(tabs)/index.tsx:311-358` — `NothingWorks`. Serif title, engine-derived reason, `Rule`, tracked eyebrow, three 32pt accent-light affordance discs. One of the two best-composed states in the app.
- [preserve exactly] `src/app/(tabs)/index.tsx:589-640` — the empty-closet composition: 132 × 152 dashed tray, colophon inside, two-line serif title, 264pt-measure body, ink pill. The `ScrollView` with `flex-grow` for Dynamic Type overflow is exactly the right mechanism.
- [minor polish] `src/components/today/weather-strip.tsx:48` + `:81, :92, :102` — every gap on the strip is `mt-2` (8); the frame sets 6 between the masthead and the weather line and 6 between the weather line and the plans line (01-today.html L50-53). — `mt-1.5` throughout. — The three context lines read as one block, which is what the guide's "no rule under the masthead" note is protecting.
- [fix inconsistency] `src/components/today/plate.tsx:530-535` vs `src/app/item/[id].tsx:478` vs `src/components/plan/day-row.tsx:126` vs `src/components/review/review-card.tsx:403` — the app has **four colour-swatch dialects**: 14pt circle w/ rule border (plate), 24pt circle w/ rule border (item detail), 16pt `rounded-sm` square (day row), 18pt circle w/ rule border (review card). The approved frames use 14pt circles on a plate and 17pt `radius: 4` squares on a day row, and nothing else. — One `Swatch` component with `size` and `shape` props; circles in a palette row, squares in a day row, and exactly two sizes. — Colour, the product's second moat after cost-per-wear, stops being drawn four different ways in one session.
- [preserve exactly] `src/components/ui/skeleton.tsx:228-262` — `PlateSkeleton` mirrors the real card's anatomy including the `aspect-[5/4]` well. Correct.

## 6 · Closet — `src/app/(tabs)/closet.tsx`, `src/components/closet/*`

Measured against `screenshots/src/03-closet.html`. The category chip row is
back (L385, L587), the profile identity is present, and the loading and error
branches are real. Remaining deltas are chip treatment and section rhythm.

- [visually refine] `src/app/(tabs)/closet.tsx:507-509` + `src/components/ui/chip.tsx:33-37` — the style-tag chips render as **transparent, hairline-outlined, 12px-radius** boxes. The approved frame draws them as **sand-filled capsules with no border**, `padding: 6px 14px`, 13px medium (03-closet.html L17, L79-81) — plainly visible in `03-closet.png`. This is the sharpest single divergence from "exactly like those pictures". — Add a `tone="fill"` variant to `Chip` (sand ground, no border) for the descriptive tags on Closet and Item detail, and keep the outlined form for the interactive category filter so selected/unselected still reads. Radius stays 12 per the house rule, which is close enough to the frame's read at 30pt tall; if the founder wants the capsule, that is a one-line decision to record — not one to make silently. — The Closet's identity block matches the frame the founder approved, and descriptive tags stop looking like unpressed buttons.
- [fix inconsistency] `src/app/(tabs)/closet.tsx:628` vs `:538, :805` — the category row uses `gap: 7, paddingVertical: 10`; the two garment rails use `gap: 14, paddingTop: 12`. Three horizontal scrollers, three spacing recipes, all hand-typed. — Pull `RAIL_GAP = 14` and `CHIP_GAP = 8` into named constants and use `GUTTER` from `tokens.ts` instead of the literal `20` at L538, L628, L805 (and `closet-grid.tsx:70`, `friends/[userId].tsx:242`). — The measure stops drifting one scroller at a time, which is exactly what the `GUTTER` export's own comment warns about.
- [visually refine] `src/app/(tabs)/closet.tsx:518, :565, :798` — section gaps are `mt-8` (32); the approved frame sets 24 above FAVOURITE PIECES and 22 above MOST WORN (03-closet.html L86, L115). — `mt-6`. — Two more rows of the wardrobe are visible before the first scroll, on the screen whose whole job is showing how much you own.
- [consolidate into component] `src/app/(tabs)/closet.tsx:767-772` and `src/components/closet/item-card.tsx:170-175` — both write `variant="stat"` plus an inline `fontSize: 13, lineHeight: leading('helvetica', 13, 1.4)`. That is `statSmall` (`text.tsx:64`), which exists for precisely this and has no consumers. — Swap both for `variant="statSmall"`; delete the `leading` import from both files. — Two fewer places that must be edited by hand when the type scale moves.
- [minor polish] `src/app/(tabs)/closet.tsx:770` vs the frame — the most-worn count is 13px; the frame sets the serif count at 15px (03-closet.html L124). — Leave at 13 if `statSmall` is adopted (13 is the scale's value and the frame's 15 is off-scale); record the deliberate deviation. — Consistency with the scale beats a 2px match to a mock that itself broke the scale.
- [minor polish] `src/app/(tabs)/closet.tsx:756` — the wear bar is `mt-2` (8) under the name; the frame sets 7. Negligible — leave.
- [fix inconsistency] `src/app/(tabs)/closet.tsx:756-760` vs `src/app/profile.tsx:404-408` vs `src/app/capture.tsx:531-536` — three progress tracks: 5pt sand + `accent-warm` (closet), 5pt sand + `accent` (profile), 6pt sand + `accent` (capture). Two heights, two fills, no shared component. — One `ProgressTrack` at 5pt with a `tone` prop; `accentWarm` for data (a wear ratio), `accent` for a task in flight (an import, a learning threshold). — The bar means one thing per colour instead of meaning whatever the screen felt like.
- [preserve exactly] `src/app/(tabs)/closet.tsx:849-884` — `EmptyCloset`: the real two-column geometry ghosted, ink type and ink CTA over it, the muted body line moved below the grid for contrast. The documented contrast contract is right, and this is the app's best empty state.
- [preserve exactly] `src/components/ui/skeleton.tsx:124-146` — `ClosetGridSkeleton` now tracks `item-card.tsx:72` exactly (`aspect-[4/5]`, `rounded-lg`). The jump-on-load is gone.
- [minor polish] `src/app/(tabs)/closet.tsx:281` — the header row is `pl-gutter pr-2` (asymmetric, so the two 44pt icon targets end flush). Correct and matching 03-closet.html L40 (`padding: 6px 8px 0 20px`). No change; noted so a later "fix the asymmetry" edit does not undo it.
- [visually refine] `src/app/(tabs)/closet.tsx:472-489` — four stats (Pieces/Outfits/Unworn/Followers) where the approved frame has three, and the frame puts them *beside* the 76pt avatar; the app moved them to their own full-width line. Documented and defensible (FOLLOWERS does not fit next to the disc). — Preserve the four-up line, but note it costs ~48pt of vertical against the frame; consider dropping the four-column row's `mt-7` (28) to `mt-5` to recover half of it. — The identity block reads in one screenful, as in `03-closet.png`.

## 7 · Plan — `src/app/(tabs)/plan.tsx`, `src/components/plan/day-row.tsx`

Measured against `screenshots/src/05-plan.html`. Structure matches; the
segmented control and row density do not.

- [fix inconsistency] `src/app/(tabs)/plan.tsx:219` + `:66` — the segmented track is `rounded-md` (12) with `p-1` (4), and each segment is **also** `rounded-md` (12). `concentric(12, 4)` = **8**, and the approved frame sets the inner radius to **9** (05-plan.html L8-9). An inner radius equal to its outer is exactly the "quiet tell of a non-native app" `tokens.ts:131-137` names. — Set the segment to `rounded-lg`… no: add a `borderRadius.seg: '8px'` or use an inline `borderRadius: concentric(12, 4)`. — The one control on the screen that iOS users compare against `UISegmentedControl` every day stops looking subtly wrong.
- [visually refine] `src/components/plan/day-row.tsx:79` — row padding is `py-3.5` (14); the approved frame sets `padding: 20px 20px` (05-plan.html L11), and `05-plan.png` reads as generously spaced. The app's week is ~40% denser than the picture the founder approved. — `py-5`. — Seven days read as an editorial week rather than a settings list; this is the single most visible fidelity gap on the Plan tab.
- [minor polish] `src/components/plan/day-row.tsx:99-100` — the weekday column is 40pt with `variant="stat"` (20px serif); the frame sets 42pt and 22px (05-plan.html L12-13). — Leave the size (20 is on the scale, 22 is not), widen to 42. — "Wed" stops sitting one point from its swatches.
- [minor polish] `src/components/plan/day-row.tsx:149-156` — the reasoning line has no top margin; the frame sets `margin-top: 2px` (05-plan.html L20). — `className="mt-0.5 text-faint"`. — The two-line cell separates into a name and its caption.
- [minor polish] `src/components/plan/day-row.tsx:146` — the garment line is `variant="body"` (17); the frame sets 16 (05-plan.html L19). — `variant="callout"`. — One more garment fits before the ellipsis on a narrow phone.
- [minor polish] `src/app/(tabs)/plan.tsx:360-370` — "This week" then the accent line at `mb-5` (20); the frame sets 8 above and 8 below (05-plan.html L57-59). — `mb-2` on the title view, `mb-2` on the accent line. — The section heading and its qualifier read as one unit, as drawn.
- [preserve exactly] `src/app/(tabs)/plan.tsx:368-370` — "Repeats kept to a minimum" replacing the frame's "No piece worn more than twice". The engine's `REUSE_BOOST` is a soft scorer, so the frame's copy was a promise the rows below it could visibly break. Honesty rule wins over the frame. Keep, and note the ASC screenshot's subline carries the old claim — worth flagging to whoever owns the listing.
- [fix inconsistency] `src/app/(tabs)/plan.tsx:235-259` — the New-event bar is `min-h-52pt` with `px-5`, and its two halves are a `body` semibold label and a `label` at `${theme.canvas}B3`. Nothing else in the app is a 52pt-tall split ink bar. — Acceptable as a one-off "primary rail", but the divider `h-5 w-hair bg-canvas opacity-25` (L246) should be `bg-canvas/25` via the palette rather than opacity on a full-strength fill. — Same visual, one fewer opacity hack.
- [preserve exactly] `src/app/(tabs)/plan.tsx:328-336` — failure-before-loading-before-absence ordering, with `useStalled` catching the query that never settles. This is the best-reasoned state machine in the codebase.
- [minor polish] `src/components/events/EventCard.tsx:128` — `p-4` on a `rounded-plate` card matches the plate. Correct; `border-rule` (not the `border-hairline` the previous audit flagged) is now right. No change.

## 8 · Lately / Explore — `src/app/(tabs)/explore.tsx`

Not drawn in any approved frame or in the field guide; audited for internal
consistency only.

- [preserve exactly] `src/app/(tabs)/explore.tsx:140-146` — `eyebrow` + 6px + `display` `trim`. Same masthead grammar as Today. Correct.
- [preserve exactly] `src/app/(tabs)/explore.tsx:185-197` — `flexGrow: 1` on the content container so the hero empty/error states keep their `flex-1` centring *and* the refresh gesture. The reasoning in the comment is right and non-obvious.
- [consolidate into component] `src/app/(tabs)/explore.tsx:222` — `<View className="h-px bg-hairline" />` where `<Rule tone="hairline" />` exists. One of fifteen. — Swap. — See §0.
- [fix inconsistency] `src/app/(tabs)/explore.tsx:154-182` vs `src/app/friends/index.tsx:184-202` — the same eight-line search field is duplicated verbatim (down to `paddingVertical: 11` and the literal `fontSize: 17`), and the code comment argues the duplication is deliberate. It is three copies now counting `closet.tsx:353-381`, and all three re-type `17` rather than reading the scale. — Extract a `SearchField` with a `placeholder` prop; the spacing above it stays each screen's own. — Three fields that can no longer disagree about their own height.
- [minor polish] `src/app/(tabs)/explore.tsx:281-295` and `:344-358` — the "Your circle ›" row appears twice with different top margins (`mt-2` and `mt-5`) and different padding. — One `LinkRow` component, one margin. — The same affordance stops moving depending on which branch drew it.

## 9 · Stylist — `src/app/stylist.tsx`, `src/components/stylist/message-bubble.tsx`

Measured against `screenshots/src/04-stylist.html`. Bubble geometry is exact:
`rounded-*-plate` with a 4px tail corner and `px-4 py-2.5` matches the frame's
`20px 20px 4px 20px` / `10px 16px` to the point.

- [preserve exactly] `src/components/stylist/message-bubble.tsx:16-17, 106, 131` — the bubble radii and padding. Transcribed correctly; do not touch.
- [preserve exactly] `src/app/stylist.tsx:39-56` — the header: accent-light disc, serif `plate` title, `caption` honesty line, hairline hand-off. Matches `04-stylist.png` exactly.
- [visually refine] `src/components/stylist/message-bubble.tsx:50-80` — the outfit strip's inner cells have **no radius and no clipping**: images render `contentFit="contain"` straight onto the tray. The approved frame sets `.strip .g { border-radius: 8px; overflow: hidden }` with `object-fit: cover`, which is why `04-stylist.png` shows four crisp rounded photo cells filling the strip (frame CSS at 04-stylist.html L29-31). — Wrap each cell in `overflow-hidden rounded-lg` — no: `rounded-` at 8px is the DEFAULT token; use `className="overflow-hidden rounded"`. — The stylist's evidence looks like the four photographs the founder approved instead of four floating cut-outs.
- [fix inconsistency] `src/components/stylist/message-bubble.tsx:51` — `rounded-card`, the deprecated transitional alias (`tailwind.config.js:169`). — `rounded-plate`. — Same 20px, one fewer alias keeping a retired token alive.
- [minor polish] `src/components/stylist/message-bubble.tsx:81-83` — the strip caption is `numberOfLines={1}`; the approved frame wraps it to two lines ("cream sweater, charcoal trousers, brown loafers, brown crossbody"). — `numberOfLines={2}`. — The look is fully credited, which is the whole point of the line.
- [fix inconsistency] `src/app/stylist.tsx:402` and `:410` — the composer is `rounded-full` on a wider-than-tall field, and the send button `rounded-full` on a 44 × 44 square (correct — a disc). The field is a capsule, matching `04-stylist.png` but contradicting `tailwind.config.js:141-158` and the `rounded-md` fields on Today (`index.tsx:745`), Closet (`closet.tsx:353`), Explore and Friends. — Decide once and record it. My recommendation: chat composers are the one place iOS itself uses a capsule (Messages, Mail), the approved frame draws one, and it is not a *labelled* control — so keep it and amend the config note to say "text fields in a conversational composer" is the third allowed capsule. — The rule stops being contradicted by a screen the founder signed off on.
- [fix inconsistency] `src/app/stylist.tsx:73` vs `:86` — `AnswerChip` is `rounded-chip` (12) with `border-rule`; `StartRow` is `rounded-md` (12, the same number) with `border-hairline`. Two aliases and two border weights for two controls that sit six points apart. — Both `rounded-md`; pick one border weight (`rule`, since they are content-layer controls). — The opening screen reads as one set of options, not two.
- [preserve exactly] `src/app/stylist.tsx:235-250` — the loading composition: a bar where the greeting goes, a bar where the subline goes, four 48pt bars where the doors go. This is what a skeleton is supposed to be, and it is the model the other screens should copy.
- [improve interaction] `src/app/stylist.tsx:346-354` — the questionnaire's answer chips are a `flex-wrap` grid at `px-gutter` directly under a bubble, with no top margin. — `className="mt-3 …"`. — The answers stop touching the question they answer.

## 10 · Capture — `src/app/capture.tsx`, `src/components/ingest/consent-sheet.tsx`

- [preserve exactly] `src/app/capture.tsx:333, 492-493` — `edges={['top','left','right']}` with the progress sheet taking `insets.bottom + 20` itself. The one screen that must not double-pad, and it does not.
- [preserve exactly] `src/app/capture.tsx:361-377` — the blocked-camera state drawn on a canvas plate *inside* the ink stage rather than as ink-on-ink. Correct reasoning, correctly executed.
- [fix inconsistency] `src/app/capture.tsx:338` — the screen title is `variant="heading"` (Helvetica 20 semibold). Every other screen title in the app is Instrument Serif (`display`, `title` or `plate`). — `variant="plate"` in canvas. — Capture stops being the one screen that changes typographic voice; the serif on ink is also the welcome screen's own move.
- [fix friction] `src/app/capture.tsx:437, 482` — "Library" and "Describe" sit in fixed `w-16` (64pt) boxes with `variant="label"` text that scales to 1.8×. "Describe" at AX-1 already exceeds 64pt and clips. — `minWidth: 64` with `numberOfLines={1}` and `adjustsFontSizeToFit`, or drop the fixed width and balance with `flex-1` + `items-start`/`items-end`. — The two non-shutter doors stay readable at accessible text sizes.
- [fix inconsistency] `src/app/capture.tsx:554` — `rounded-card` (deprecated alias) on the failure banner; `review.tsx:270, 440` and `review-card.tsx:300` do the same. — `rounded-plate`. — Four of the five remaining uses of a retired token go away.
- [minor polish] `src/app/capture.tsx:531` — the progress track is `h-1.5` (6pt); every other track in the app is 5pt. — `h-[5px]`, or adopt the shared `ProgressTrack` from §6. — One bar height.
- [preserve exactly] `src/components/ingest/consent-sheet.tsx:69, 88-91` — the grabber and the `theme.scrim` backdrop. Both gaps the previous audit named are closed; the sheet now reads as a moment inside capture.
- [fix inconsistency] `src/components/ingest/consent-sheet.tsx:93` — content padding is `px-8` (32) where the app's measure is `GUTTER` = 20 everywhere else. The only other `px-8` is `social-terms-sheet.tsx:66`, which is out of scope. — `px-gutter`. — The one sheet whose text measure differs from every page comes back onto the grid.
- [fix inconsistency] `src/components/ingest/consent-sheet.tsx:127` — the primary is `h-14` (56pt) with `rounded-plate` (20). Every other primary in the app is `Button`: 44pt minimum, `rounded-md` (12). — `rounded-md`, `minHeight: 52`. — The most important consent button in the app stops being the only button shaped like a card.
- [preserve exactly] `src/app/capture.tsx:504-518` — the progress line moved off `variant="stat"` onto `body` with tabular figures. The reasoning ("a status line is not a hero figure") is exactly the discipline the type system is for.

## 11 · Review — `src/app/review.tsx`, `src/components/review/review-card.tsx`

- [preserve exactly] `src/app/review.tsx:52-57` — `useSafeAreaInsets` applied by hand because `SafeAreaView` reads zero inside a `fullScreenModal`. Non-obvious, correct, and load-bearing. Do not "simplify" it back.
- [fix friction] `src/app/review.tsx:385-393` — the pip bar renders one pill per queue item with `flex: 1, maxWidth: 16` and `gap-1`. At `total = 60` (the documented sixty-photo import) the available ~350pt minus 59 × 4pt of gaps leaves under 2pt per pip — a grey smear with an invisible ink marker in it. — Cap at ~12 pips and render "· 14 more" as a colophon, or switch to a single 5pt track with a filled fraction (the `ProgressTrack` from §6) above 12 items. — The one position indicator in a sixty-item chore stays legible.
- [fix inconsistency] `src/app/review.tsx:268` — `px-5` where the app's measure is `px-gutter` (20 — the same number, spelled off-token). Also `plan.tsx:241, 254`, `button.tsx:78`, `review-card.tsx:509`, `event/[id]/index.tsx:87`. — For page containers use `px-gutter`; `px-5` inside a *button* is fine and should stay (it is padding, not a measure). Fix only `review.tsx:268`. — The gutter has one spelling on page-level containers.
- [preserve exactly] `src/app/review.tsx:258-289` — the loading composition: colophon bar, then the card's own anatomy (title, subtitle, 176pt photo well, three spec rows). Correct and specific.
- [preserve exactly] `src/components/review/review-card.tsx:504-527` — "Skip" as a `secondary` Button beside a hand-built ink "Looks right", with the accent deliberately reserved for the Edit affordances. The one-accent rule applied inside a card, and the comment explains why the shared Button could not be used.
- [preserve exactly] `src/components/review/review-card.tsx:558-575` — `Edit` renders only on the rows the pipeline can actually patch. The previous audit's "decorative Edit" finding is resolved.
- [minor polish] `src/components/review/review-card.tsx:403` — 18pt colour circles; see the four-swatch-dialect finding in §5. — Fold into the shared `Swatch`.

## 12 · Item detail — `src/app/item/[id].tsx`

- [add missing state] `src/app/item/[id].tsx:125-131` — **the only bare full-screen `ActivityIndicator` left in the main flow.** Every sibling screen got a designed skeleton; this one still resolves out of a centred spinner. — An `ItemSkeleton`: the square well, a title bar, a `label` bar, then the 2 × 2 stat grid as four bars. — The garment arrives into its own outline instead of replacing a spinner, matching the standard the rest of the app now holds.
- [consolidate into component] `src/app/item/[id].tsx:251-262` — a hand-copied back disc + centred colophon + 36pt balancing spacer. This is `<ScreenHeader title={item.category} />` verbatim (`screen-header.tsx:82-90`). — Swap. One of eleven; see §0. — Gains the `hitSlop` guarantee for free and deletes twelve lines.
- [consolidate into component] `src/app/item/[id].tsx:635-644` — `variant="stat"` with an inline `fontSize: 28, lineHeight: leading('instrument', 28, 1.05), letterSpacing: -0.15`. That is *exactly* `statFigure` (`text.tsx:66` → `text-figure` = 28 / 1.05 / -0.15), which was added for this cell and is used once, elsewhere. — `variant="statFigure"` and keep only the `color` in `style`. — Nine lines and one duplicated token definition gone; the hero figure follows the scale.
- [consolidate into component] `src/app/item/[id].tsx:519` — `<View className="h-px bg-hairline" />` where `<Rule tone="hairline" />` exists.
- [preserve exactly] `src/app/item/[id].tsx:294-318` — the 2 × 2 stat grid with the inverted cost-per-wear cell, internal cross-lines from per-cell borders, the 8px colophon override with its documented reason. The signature element of the screen and it is right.
- [preserve exactly] `src/app/item/[id].tsx:491-495` and `:324-328` — "Works with N of your other pieces" and the computed CPW trend. Both gaps the previous audit named are closed, and both are computed rather than canned. This is the moat printed on the page.
- [fix inconsistency] `src/app/item/[id].tsx:245` — `SafeAreaView` with no `edges`, so it insets **all four** sides, while the content container also carries `pb-24`. Every other stack screen uses `edges={['top']}`. — `edges={['top']}`. — Consistent bottom rhythm; ~34pt of dead space at the foot of the scroll goes away on a notched device.
- [visually refine] `src/app/item/[id].tsx:334-356` — the price row's "Edit" / "Add price" is the screen's one oxblood, set as a bare `label` at the right edge with a 44pt invisible target. Below it sits a `rounded-plate` Borrowable card, then a `rounded-plate` maintenance plate. The oxblood word floats between two carded blocks with nothing framing it. — Move the price affordance *into* the stat grid's footer as a ruled row, or give it the same `rounded-plate` treatment as its neighbours. — The one action that turns the hero tile from "—" into the number the product is about stops reading as a stray caption.
- [minor polish] `src/app/item/[id].tsx:478` — 24pt colour circles, the largest of the four dialects. See §5.

## 13 · Profile — `src/app/profile.tsx`

- [consolidate into component] `src/app/profile.tsx:450, 504, 510, 522, 524, 526` — **six** hand-rolled `<View className="h-px bg-hairline" />` dividers on one screen, where `<Rule tone="hairline" />` exists. — Swap all six. — See §0; this is the densest concentration in the app.
- [fix inconsistency] `src/app/profile.tsx:335` — the user's name is `variant="plate"` (24) here and `variant="title"` (28) on the Closet identity block (`closet.tsx:438`). The same fact, two sizes, on two screens the user moves between in one tap. — `title` on both, or `plate` on both; `title` matches the approved 03 frame's identity block. — One person, one name size.
- [add missing state] `src/app/profile.tsx:311-538` — the screen is presented as a plain `modal` (see §1) and draws **no close control at all** — no "Done", no grabber, no back. Dismissal is the undiscoverable system swipe. — Either the `formSheet` + grabber change in §1, or a "Done" ghost `Button` in a header row like `review.tsx:364-366`. — The settings screen stops being a place users think they are trapped in.
- [preserve exactly] `src/app/profile.tsx:318-327` — the skeletal masthead. The blank-on-first-paint bug the previous audit named is fixed and the skeleton matches the real row's geometry (56pt disc, two bars).
- [preserve exactly] `src/app/profile.tsx:375-424` — the "What Cinch has learned" card with its three honest branches, the threshold-accurate progress bar, and the serif "Getting to know you" caption. Exactly the field guide's 09.
- [minor polish] `src/app/profile.tsx:534-536` — the delete caption is `text-center` while every other line on the screen is hard-left on the gutter. The Plate grammar has no centred body copy. — Left-align. — The last line of the page stops breaking the page's one alignment rule.
- [fix inconsistency] `src/app/profile.tsx:404-408` — the learning bar is `accent`; the Closet's wear bars are `accent-warm`. Both are "how much of a maximum". See the `ProgressTrack` finding in §6.
- [preserve exactly] `src/app/profile.tsx:459-496` — the consent switch withheld behind a spinner rather than defaulting to "off". A control that lies for a beat is worse than a control that waits.

## 14 · Event detail — `src/app/event/[id]/index.tsx`, `src/components/event-outfits/OutfitPostCard.tsx`

Measured against `screenshots/src/02-event.html`. The composition point is
resolved — YOUR LOOK and WHO'S WEARING WHAT now render on the page, the group
stylist note exists (L552-556), and the title is `title` not `display`. This
screen went from the worst structural gap in the app to a close match.

- [preserve exactly] `src/app/event/[id]/index.tsx:514-556` — blush "Your look" card → `Who's wearing what` eyebrow with the `n of m shared` colophon opposite → the attendee grid → the tray-filled group note. This is `02-event.png`, in order. Do not restructure.
- [visually refine] `src/app/event/[id]/index.tsx:478-484` — a `VenueCard` is inserted between the RSVP row and the blush card. The approved frame goes straight from "Going" to YOUR LOOK (02-event.html); the venue facts are already in the metadata line at L411. The card costs ~90pt and pushes the screen's centrepiece below the fold on a 6.1". — Move `VenueCard` below the group note (it is logistics, not the decision), or fold it into the metadata line it duplicates. — The blush card — the thing the whole social layer exists for — is on screen when the page opens, exactly as approved.
- [consolidate into component] `src/app/event/[id]/index.tsx:270-282` — the twelfth hand-copied back row; this one is `ScreenHeader align="leading" title="Event"`. — Swap.
- [fix inconsistency] `src/app/event/[id]/index.tsx:487-499` and `:581-591` — two hand-rolled error compositions (a `body` line, a `caption`, a secondary `Button`) on a screen that already imports `ErrorState`. `ErrorState compact` renders the same anatomy with the warning glyph and the honest default copy. — Use `ErrorState compact` for both. — Four error dialects across the app collapse toward one.
- [minor polish] `src/app/event/[id]/index.tsx:553-554` — the group note is `variant="callout"` (16) in `p-4`; the frame's note reads at body size (17) — `02-event.png` shows it as the largest muted line on the screen, which is what makes the stylist's voice land. — `variant="body"`. — The one sentence on the page that is the stylist speaking gets the weight the frame gives it.
- [consolidate into component] `src/components/event-outfits/OutfitPostCard.tsx:89-109` — `InitialAvatar`, a fifth avatar implementation (sand fill, `caption` initials, own `initialsFor` logic) in a codebase where `Avatar` exists, is adopted by six call sites, and already supports `tone="sand"` at `size=28` with a diameter-derived type size. `ProfileRow.tsx:55` and `event/[id]/invite.tsx:141` are the other two holdouts. — Delete `InitialAvatar` and the two hand-built discs; use `Avatar`. — Avatars stop being the most-duplicated component in the app; the diameter→type-size rule applies everywhere.
- [preserve exactly] `src/components/event-outfits/OutfitPostCard.tsx:232-252` — the crown as the screen's single `bouncy` spring, in `accentWarm` not oxblood, respecting `useReducedMotion`. The one-bounce rule honoured, and the right colour argument (celebration, not a call to action).
- [preserve exactly] `src/components/event-outfits/OutfitPostCard.tsx:147-210` — `LookStack` reuses `stackLayout`/`stackRegime` so a posted look and this morning's plate are literally the same geometry. That identity is the product argument.

## 15 · The rest of the event stack — `new.tsx`, `outfits.tsx`, `post.tsx`, `comments.tsx`, `invite.tsx`

Not drawn in the approved frames beyond 02; audited for internal consistency.

- [consolidate into component] `event/new.tsx:174`, `event/[id]/outfits.tsx:261`, `event/[id]/post.tsx:99`, `event/[id]/comments.tsx:144` — four more hand-copied back discs, each identical to `screen-header.tsx:29`. (`invite.tsx` correctly has none — it is pushed with native chrome.) — Swap all four for `ScreenHeader`. — See §0.
- [fix inconsistency] `src/app/event/new.tsx:78` — a `rounded-full` bordered control that is *not* 1:1 (a date/step selector) — the exact shape `tailwind.config.js:150-152` forbids. — `rounded-md`. — The last labelled capsule in the content layer.
- [preserve exactly] `src/app/event/new.tsx:161` — the code comment explicitly refuses the deprecated `rounded-card` alias in favour of `rounded-md`. This is the discipline the other five `rounded-card` sites should copy.

## 16 · Friends, friend closet, borrowing — `friends/index.tsx`, `friends/[userId].tsx`, `borrow.tsx`

- [consolidate into component] `friends/index.tsx:165-176` and `borrow.tsx:103-114` — identical back-disc + centred colophon + 36pt spacer rows, followed by a separate `px-gutter pt-3` display title. That is `ScreenHeader align="center"` plus a title. `friends/[userId].tsx:174-192` is the same row with a real overflow disc in the trailing slot — which is exactly what `ScreenHeaderProps.trailing` (`screen-header.tsx:49`) is for. — Swap all three. — See §0.
- [fix inconsistency] `src/app/friends/index.tsx:222-233, 272-283, 313-324` — **three** hand-rolled error blocks on one screen: a `text-critical` body line plus a ghost "Try again". `ErrorState compact` exists, renders the warning glyph, the serif title and a secondary button, and is used correctly two files away in `explore.tsx:209`. — Replace all three. — The same failure looks the same everywhere, and the honest "this doesn't mean your circle is empty" framing comes from the component rather than being retyped.
- [consolidate into component] `friends/index.tsx:241, 287, 339`, `borrow.tsx:84`, `BlockedList.tsx:91` — five more inline hairlines. — `Rule tone="hairline"`.
- [fix inconsistency] `src/app/friends/index.tsx:326-329` — loading renders two bare `RowSkeleton`s inside a `px-4 py-3.5` box, while `ListSkeleton` (`skeleton.tsx:191`) exists and varies the bar widths so a column of rows does not stripe. `borrow.tsx:137` uses `ListSkeleton` correctly. — Use `ListSkeleton count={2}` inside the card. — Two identical bars stop reading as a loading *graphic*.
- [preserve exactly] `src/app/borrow.tsx:122-146` — failure → loading → empty, in that order, with `ErrorState` and `ListSkeleton`. The false-empty-during-load bug the previous audit named is fixed, and this file is now the reference implementation.
- [minor polish] `src/app/friends/index.tsx:200` and `friends/[userId].tsx:293` — the literal `fontSize: 17` again. Fold into the `SearchField` extraction from §8.

## 17 · Not found — `src/app/+not-found.tsx`

- [preserve exactly] `src/app/+not-found.tsx:24-31` — a session-aware `Redirect` rather than a designed error page, because the URL is attacker-controlled and expo-router's own fallback ships a sitemap of every internal route in release builds. There is nothing honest to show a person here, and the file says so. Rendering an `ErrorState` instead would be a regression, not a refinement. Do not touch.

---

## 18 · Cross-cutting

- [consolidate into component] **`ScreenHeader` / `BackButton` have zero consumers** across nine hand-copied call sites: `item/[id].tsx:252`, `event/[id]/index.tsx:271`, `event/[id]/outfits.tsx:261`, `event/[id]/post.tsx:99`, `event/[id]/comments.tsx:144`, `event/new.tsx:174`, `friends/index.tsx:166`, `friends/[userId].tsx:175`, `borrow.tsx:104`. — Adopt. — One accessibility contract (`hitSlop={8}` around a 36pt disc, which is what clears the 44pt floor) instead of nine copies of it, ~110 lines deleted, zero visual change.
- [consolidate into component] **`Rule` has six consumers and fifteen inline rivals** (`profile.tsx` ×6, `friends/index.tsx` ×3, `borrow.tsx`, `item/[id].tsx`, `explore.tsx`, `BlockedList.tsx`, plus `dev-profile.tsx` ×4). — Adopt.
- [consolidate into component] **`statSmall` has zero consumers, `statFigure` has one**, while `item-card.tsx:170`, `closet.tsx:767` and `item/[id].tsx:635` hand-set the exact values those variants encode. — Adopt.
- [fix inconsistency] **Deprecated `rounded-card` alias** (`tailwind.config.js:169`, marked "retire as screens are rewritten") survives at `capture.tsx:554`, `review.tsx:270`, `review.tsx:440`, `message-bubble.tsx:51`, `review-card.tsx:300`. — Replace all five with `rounded-plate` and delete the alias from the config; the same for `rounded-chip` → `rounded-md` once its ~15 skeleton uses are swept. — The radius scale has one name per value.
- [fix inconsistency] **Four error-presentation dialects**: `ErrorState` (correct), `ErrorState compact` (correct), hand-rolled critical-text-plus-ghost-button (`friends/index.tsx` ×3, `event/[id]/index.tsx` ×2), and inline critical `label` lines (`item/[id].tsx:389, 529`). The last is fine for a field-level save failure; the middle one is not. — Collapse the middle dialect into `ErrorState compact`.
- [fix inconsistency] **`GUTTER` is typed as the literal `20`** in five `contentContainerStyle` blocks (`closet.tsx:538, 628, 805`, `closet-grid.tsx:70`, `friends/[userId].tsx:242`) — exactly the drift `tokens.ts:142-149` exports the constant to prevent. — `paddingHorizontal: GUTTER`.
- [minor polish] **Dynamic Type discipline is uneven.** `text.tsx` caps at 1.4× for display and 1.8× otherwise, and four call sites correctly tighten to 1.4 for fixed cells. But every raw `TextInput` in the app (`index.tsx:752`, `closet.tsx:360`, `explore.tsx:161`, `friends/index.tsx:186`, `stylist.tsx:383`, `sign-in.tsx:581`, `item/[id].tsx:365`) scales unbounded inside boxes sized in points. — Audit each field for `minHeight` (not `height`) and consider `maxFontSizeMultiplier` on the fields inside fixed-height chrome.
- [reject] **Reverting the plate stack to the guide's flat 4-tile row.** The approved frames themselves (01-today.html L69-82) draw an overlapping four-tile stack, not the guide's flat row — the founder's own screenshots ratify the app's decision. `field-guide-audit.md` §5.1 already ruled this out; the ASC frames now confirm it independently.
- [reject] **Capsule buttons everywhere, to match the guide's 20–30px radii.** The house rule (`tailwind.config.js:141-158`) is the stronger position and the approved frames mostly follow it (`base.css` `.pill { border-radius: 12px }`). The two genuine exceptions — the welcome screen's Apple button and the stylist composer — should be *recorded* as exceptions, not generalised.
- [reject] **Sand-filled capsule chips as a global chip style.** The approved 03 frame draws the *descriptive* tags that way (`base.css` has no `.chip`; 03-closet.html L17 defines it locally at `border-radius: 999px`), but the same shape on the interactive category filter would erase the pressed/selected distinction the filter needs. Add the filled tone for descriptive tags only — see §6.

---

## Top 15, ranked by impact

Impact = how much of the app it improves × how visible the improvement is,
divided by risk. Items 1–5 are visual fidelity to the frames the founder
approved; 6–10 are consistency debts that are already paid for (the components
exist); 11–15 are polish.

1. **Loosen the Plan week rows to the approved density.** `day-row.tsx:79` `py-3.5` → `py-5`. The approved `05-plan.png` is airy; the app is 40% denser. Single highest-visibility gap against any of the five frames.
2. **Adopt `ScreenHeader` / `BackButton` across all nine screens.** Zero visual change, ~110 lines deleted, one accessibility guarantee instead of nine copies, and the app's most-repeated fragment stops being able to drift.
3. **Give the Chip a sand-filled tone and use it for descriptive tags** (`chip.tsx`, `closet.tsx:507`, `item/[id].tsx:461`). Closes the sharpest colour/treatment divergence from `03-closet.png`, and stops read-only tags looking like unpressed buttons.
4. **Fix the Plan segmented control's concentric radius** (`plan.tsx:66`, 12 → `concentric(12,4)` = 8). One number; removes a native-fidelity tell on the control iOS users benchmark daily.
5. **Round and clip the stylist outfit-strip cells** (`message-bubble.tsx:50-80`, add `overflow-hidden rounded` + `contentFit="cover"`). Makes the stylist's evidence match `04-stylist.png`; the strip is the screen's only image.
6. **Move `VenueCard` below the group note on the event page** (`event/[id]/index.tsx:478`). Puts the blush "Your look" card — the whole point of the social layer, and the hero of `02-event.png` — above the fold.
7. **Design Item detail's loading state** (`item/[id].tsx:125-131`). The last bare full-screen spinner in the main flow, on a screen every closet tap leads to.
8. **Adopt `statSmall` / `statFigure` and delete the three inline size overrides** (`item-card.tsx:170`, `closet.tsx:767`, `item/[id].tsx:635`). The variants were built for exactly these three call sites and are unused.
9. **Stabilise the reaction row's geometry** (`reaction-bar.tsx:152-201`, `plate.tsx:549`). The card currently changes width distribution and height at the moment of the tap — the most-performed interaction in the app.
10. **Give Profile a visible way out** (`_layout.tsx:283` → `formSheet` + grabber, or a Done row). A settings modal with no close control is the failure users describe as being stuck.
11. **Adopt `Rule` for all fifteen inline hairlines**, six of them on Profile alone. Free; the component exists and documents the two weights.
12. **Replace the three hand-rolled error blocks on Friends and two on Event detail with `ErrorState compact`.** Collapses four error dialects to two and inherits the honest "this doesn't mean it's empty" framing.
13. **Tighten Today's rhythm to the approved frame**: `p-3.5` on the plate card, `mt-3`/`mt-4` above the pill and the first plate, 10/12/10 in the footer, `mt-1.5` in the weather strip. ~20pt recovered above the fold on the app's home screen.
14. **One `Swatch` and one `ProgressTrack`.** Four swatch dialects (14/16/18/24pt, circles and squares) and three progress tracks (5/5/6pt, two fills) across seven files, for the two data ideas the product is built on.
15. **Sweep the deprecated `rounded-card` alias** (`capture.tsx:554`, `review.tsx:270`, `review.tsx:440`, `message-bubble.tsx:51`, `review-card.tsx:300`) and delete it from `tailwind.config.js`. Zero-risk; the radius scale ends up with one name per value.
