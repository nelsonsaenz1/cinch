# Design-system consistency audit

Scope: every file under `src/`, excluding `src/theme/tokens.ts` and `tailwind.config.js` (the
sources of truth themselves). Read-only audit per `docs/refurb/CHARTER.md`. Every finding is
classified per the charter's scheme: preserve exactly / minor polish / visually refine / improve
interaction / consolidate into component / fix inconsistency / fix friction / add missing state /
reject (with reason).

Reference scales used throughout (from `src/theme/tokens.ts` + `tailwind.config.js`):
- **spacing** — `hair` 1, `rhythm` 8, `bezel` 12, `gutter` 20, `bare` 24, `section` 28, `tap` 44
- **radius** — `xs` 2, `sm` 4, `DEFAULT` 8, `md`/`chip` 12, `lg` 16, `plate`/`card` 20, `sheet` 38, `full` 9999 (circles/glass chrome only, never a labelled capsule)
- **type** — `colophon` 10/ls1.4, `caption`/`eyebrow` 11/ls0.1‖1.6, `label` 13/ls0, `callout` 16/ls0, `body` 17/ls0, `heading` 20/ls-0.2, `title`/`figure` 28/ls-0.15, `display` 40/ls-0.3, `wordmark` 64/ls-0.6
- **motion** — `motion.duration` fast 140 / base 220 / slow 380; `spring` smooth / snappy / bouncy (exactly once, plate landing) / interactive

---

## 1. Hardcoded hex / rgba outside the token files

- **[fix inconsistency]** `src/app/(tabs)/closet.tsx:869` — `style={{ color: '#FBFAF6' }}` on the "Add clothes" empty-state CTA label — should be `theme.canvas` (or, since it's a static literal, the `canvas` className isn't available on `RNText` colour props here, so import `theme` and use `theme.canvas`). This is the **only raw hex color literal on a production interactive element** in the whole app outside data tables and dev screens — everything else in this file goes through tokens.
- **[fix inconsistency]** `src/app/(auth)/sign-in.tsx:314-320` — a self-contained palette of 9 raw hex/rgba values (`#37342F`, `#282623`, `#A9B2C0`, `#5E6874`, `#BB9179`, `#754C3C`, `#F0EADE`, `#A49E90`, `#D8B7A6`, plus `captionLight = 'rgba(251,250,246,0.82)'`) driving the swatch-chip gradient mock and hero caption color. None reference the locked palette; they're a parallel "mock" palette for decorative swatches. Low risk (decorative, not semantic) but should either be named tokens or explicitly marked as an approved one-off illustration palette.
- **[fix inconsistency]** `src/app/(auth)/sign-in.tsx:237` — `LinearGradient colors={['rgba(20,19,17,0.5)', 'rgba(20,19,17,0)', 'rgba(20,19,17,0.9)']}` — `20,19,17` is a *fourth* near-black, distinct from `ink` (`28,26,22`) used for `scrim` elsewhere. Should derive from `theme.scrim`/`theme.ink` rather than a hand-mixed near-black.
- **[consolidate into component]** `src/components/today/garment-cell.tsx:235,244`, `src/components/closet/plate-thumb.tsx:86-87`, `src/features/explore/new-addition-row.tsx:109` — **the same "text color against a garment swatch" logic** (`'#FFFFFFCC'` on dark garments / `'#1C1A16AA'` on light garments, gated on `isDarkHex(swatch)` or an OKLCH lightness check) is independently reimplemented three times with the literal alpha-suffixed hex hardcoded in each. This should be a single exported helper (e.g. `contrastTextOn(swatch)` in `src/lib/color/`) returning `theme.canvas`-with-alpha / `theme.ink`-with-alpha, not three copies of the same two magic strings.
- **[consolidate into component]** `src/components/today/plate.tsx:73,270` and `src/components/event-outfits/OutfitPostCard.tsx:29,192-195,222` — the **same "contact shadow" recipe** (`dx:0, dy:5, blur:11, color:'rgba(28,26,22,0.16)'`, i.e. `ink` at 16%) is declared as an independent local `CONTACT` constant in each file, and each file spends it twice (once for the RN `style` shadow props, once for a `<Shadow>` component). One file sources the RN-shadow color from the raw hex, the other from `theme.ink` — same value, inconsistent sourcing. Should be one exported `shadow.contact` token.
- **[minor polish]** `src/components/ui/skeleton.tsx:21-22` — `SHIMMER_BASE = '#ECE8DF'`, `SHIMMER_HIGHLIGHT = '#F5F2EB'` — two hand-picked near-`sand`/near-`tray` tones for the shimmer gradient, not derived from `sand`/`tray`. Likely intentional (shimmer needs its own two-stop gradient, not a flat token), but worth confirming against `sand` (`#EAE5DB`) / `tray` (`#F0ECE3`) rather than re-picking two adjacent warm neutrals by eye.
- **[minor polish]** `src/components/event-outfits/OutfitPostCard.tsx:43-44` — `BLUSH_SURFACE = '#F7EDE8'`, `BLUSH_BORDER = 'rgba(176,138,118,0.45)'` — these are **byte-identical to `theme.blush` / `theme.blushRule`**, already promoted to tokens per the tokens.ts docblock ("Promoted out of `event/[id]/outfits.tsx`... so the shared-look grammar can spread without the hex spreading with it"). This file still hardcodes the pre-promotion literals instead of importing the now-existing token — the exact drift the promotion was meant to prevent.
- **[fix inconsistency]** `src/components/share/plate-card.tsx:35-48` — a fully separate 9-color palette (`ground`, `cream`, `tan`, `rose`, `faint`, `tile`, plus `rule`/`dotEdge` rgba at lines 44/46) for the Instagram-share export canvas, and a **pure-black shadow** at line 171 (`shadowColor: '#000000'`, opacity 0.45) — inconsistent with the warm-ink shadow used everywhere else in-app (`#1C1A16`/`theme.ink` at 0.16 opacity). Because this renders an exported static image rather than live UI, a fully separate palette may be defensible, but the pure-black shadow specifically should be `theme.ink` for visual family resemblance to the in-app plate it's capturing.
- **[preserve exactly]** `src/lib/color/families.ts` (lines 109-228) — ~90 hex values. This is a **garment-color naming lookup table** (domain data mapping color words like "burgundy"/"cognac" to swatch hexes for closet items), not a UI styling surface. Correctly out of scope for token consolidation — flagged only to confirm it was reviewed and excluded deliberately.
- **[preserve exactly]** `src/app/dev-*.tsx` (dev-review.tsx:32, dev-screens.tsx:58-59, dev-plan.tsx multiple, dev-screens.tsx:124) and `src/components/ui/ghosted-rail.tsx` (comment-only hex references) — dev-only fixture data / doc comments, not shipped UI. Lower priority than production files but dev-plan.tsx's garment swatches duplicate colors already in `families.ts` and could source from there instead of re-typing hex.
- **[fix inconsistency]** `src/app/capture.tsx:415` — `textShadowColor: 'rgba(0,0,0,0.55)'` — another pure-black, inconsistent with the warm-ink shadow family used elsewhere (see plate-card.tsx above); should be `rgba(28,26,22,0.55)` or reference `theme.ink`.
- **[minor polish]** `src/app/item/[id].tsx:652`, `src/app/dev-screens.tsx:124` — `'rgba(251,250,246,0.7)'` (canvas at 70%) hardcoded rather than deriving from `theme.canvas`.
- **[minor polish]** `src/components/ingest/garment-search-sheet.tsx:445` — `'rgba(251,250,246,0.72)'` — a third, close-but-different canvas-alpha value (72% vs 70% above) for what looks like the same "scrim over photography" role — should converge on one canvas-alpha constant if the intent is the same effect.

---

## 2. Hardcoded spacing vs. spacing tokens

**Exact token matches, hand-typed instead of imported/classed** — [fix inconsistency]:
- `src/app/(tabs)/closet.tsx:538,628,805` — `paddingHorizontal: 20` (×3) → `gutter`/`GUTTER`
- `src/app/(tabs)/closet.tsx:538,805` — `paddingTop: 12` (×2) → `bezel`
- `src/app/(tabs)/index.tsx:604`, `src/app/dev-today.tsx:132` — `paddingBottom: 12` → `bezel`
- `src/app/friends/[userId].tsx:242` — `paddingHorizontal: 20` (FlashList `contentContainerStyle`) → `GUTTER` — this is precisely the "handful of places that cannot use the class" case `GUTTER` was exported for, still typed raw
- `src/components/closet/closet-grid.tsx:70` — `paddingHorizontal: 20`, with a comment literally reading *"20 = spacing.gutter"* directly above the raw literal — the strongest single example of "typing 20 by hand," self-documented
- `src/app/dev-closet.tsx:109`, `src/app/dev-today.tsx:178,213` — `paddingTop: 8` → `rhythm`
- `src/app/capture.tsx:35-38`, `src/app/dev-capture.tsx:56-59` — `top/left/right/bottom: 20` (×4 each, capture-frame corner brackets) → `GUTTER`
- `src/components/ui/ghosted-rail.tsx:74,80` — `const GAP = 12` / `const STAGGER = 8` — hand-typed constants equal to `bezel`/`rhythm`, not imported
- `src/app/dev-closet.tsx:44` — `const GUTTER = 20;` — **local re-declaration of the exact exported constant** from `src/theme/tokens.ts`, instead of importing it

**Off-scale one-off numbers (drift, no token match)** — [minor polish] unless noted:
- `paddingVertical: 11` — 5 near-identical occurrences (`closet.tsx:371`, `explore.tsx:176`, `dev-closet.tsx:71`, `friends/index.tsx:200`, `edit-profile-sheet.tsx:333`) — all "text-field vertical centering," copy-pasted, sits between `rhythm`(8)/`bezel`(12)
- `gap: 14` (`closet.tsx:538,805`), `gap: 7` (`closet.tsx:628`, `dev-closet.tsx:84`), `paddingVertical: 10` (`closet.tsx:628`, `event/[id]/comments.tsx:259`, `friends/[userId].tsx:290`)
- `marginTop: 6` — 7 occurrences (eyebrow→title spacing: `sign-in.tsx:663`, `explore.tsx:142`, `index.tsx:165,211`, `dev-today.tsx:47,115,180`)
- `marginTop: 2` (`index.tsx:171,217`, `dev-today.tsx:53`), `marginTop: 26` (`index.tsx:609`, `dev-today.tsx:137` — close to `bare`/`section` but neither), `marginTop: 10` (`index.tsx:673`, `dev-today.tsx:178`), `marginTop: 16` (`empty-state.tsx:91`, `error-state.tsx:75` — consistent between the two, still off-scale), `marginTop: 32` (`dev-screens.tsx:66`)
- `paddingBottom: 96` (`friends/[userId].tsx:242`, `closet-grid.tsx:70` — consistent, = 4×`bare`, but not itself a token), `bottom: 22` (`capture.tsx:410`, `dev-capture.tsx:142` — consistent pair, no token)
- `EventCard.tsx:151` — `marginLeft: -8` (negative `rhythm`, avatar-stack overlap, not derived from the token)
- `garment-search-sheet.tsx:355,357,389,428` — hand-typed half-`bezel` grid math (`-6`/`6`) instead of a `gap` class

**[reject — systemic, needs its own pass, not a spot-fix]** `src/app/(auth)/sign-in.tsx` runs a fully parallel spacing system: `const px = (mock) => mock * s` (line 308, device-width scale factor) applied at ~15 call sites (lines 388-629: `px(6)`, `px(16)`, `px(7)` ×3, `px(34)`, `px(31)`, `px(4)`, `px(22)`, `px(28)`, `px(9)`, `px(19)`, `px(50)` ×3, `px(11)`, `px(8)`). None reference `gutter`/`rhythm`/`bezel`/`bare`/`section`. This is a device-proportional mock-transcription approach for a hero screen and may be intentional for matching a specific comp exactly — flagging as a systemic exception rather than a line-by-line fix, since converting it piecemeal to fixed tokens would fight its own design intent. Recommend a design decision on whether the hero should convert to the token scale or keep its own documented, bounded scaling system.

---

## 3. Corner radius vs. the radius scale / concentric rule

- **[fix inconsistency]** `src/components/today/plate.tsx:63` and `src/components/event-outfits/OutfitPostCard.tsx:31` — `const TILE_RADIUS = 10` — the same magic number independently declared in two files (comment claims it's concentric with the tile's own corner, but `concentric(outer, inset)` is never actually called — it's hand-typed). Should be one shared constant, ideally computed via `concentric()`.
- **[minor polish]** `src/components/ui/ghosted-rail.tsx:166` — `borderRadius: 16` in a raw `style={{}}` — matches `lg` exactly (comment even says "the closet cell's own radius (`rounded-lg`)") but bypasses the className token.
- **[minor polish]** `src/app/(tabs)/index.tsx:600`, `src/app/dev-today.tsx:128` — `borderRadius: 8` (matches `DEFAULT`), `src/components/ingest/garment-search-sheet.tsx:176` — `borderRadius: 8` on a swatch image (matches `DEFAULT`) — all hand-typed rather than `rounded`.
- **[fix inconsistency]** `src/app/(auth)/sign-in.tsx:498-499` — bottom-sheet `borderTopLeftRadius`/`borderTopRightRadius: px(24)` — the app's `sheet` token is 38px; this sheet renders at ~24px scaled, unrelated to the token and visually flatter than every other sheet in the app.
- **[fix inconsistency]** `src/app/(auth)/sign-in.tsx:396,403,413,420` — `radius={px(14)}` on decorative swatch tiles — 14 isn't on the 2/4/8/12/16/20/38 scale.
- **[minor polish]** `src/components/share/plate-card.tsx:194,369` — a *third* scaling helper, `z()`, distinct from `sign-in.tsx`'s `px()`, used for `borderRadius: z(8)` / `z(16)/2` on the export canvas. Flagged for awareness (out-of-app-flow export renderer) rather than a fix.
- See also §4 below for the concentrated set of `rounded-full` capsule violations, which are corner-radius findings specifically about the `full`/circle-only rule.

---

## 4. `rounded-full` used on a labelled capsule (violates the circle-only rule)

Per `tailwind.config.js`'s own comment: `full` is allowed only on 1:1 boxes (circles); any wider-than-tall control carrying a text label must be `md` (12px). The following are **[fix inconsistency]** — they are the exact violation the token file calls out as already-fixed elsewhere ("the segmented toggle on Plan, the RSVP pills on an event, the New-event bar — all capsules, all wrong, all `md`"), meaning these specific sites were missed in that pass:

- `src/app/stylist.tsx:402` — chat `TextInput`, `className="flex-1 rounded-full border ... px-4 py-2.5 ..."` — full-width text input carrying the user's typed message
- `src/app/dev-stylist.tsx:109` — identical dev mirror of the same input
- `src/app/dev-closet.tsx:91` — category filter chip (`rounded-full border px-3.5 py-1.5`) with a text label — the production `Chip` component (`src/components/ui/chip.tsx`) already does this correctly at `rounded-chip` (12px); this dev screen didn't adopt it
- `src/app/(auth)/sign-in.tsx:562` — "Continue with email" button, `borderRadius: px(26)` on a full-width, fixed-height `Pressable` with a text label — a pill button
- `src/app/(auth)/sign-in.tsx:612` — email `TextInput`, `className="flex-1 rounded-full px-4 ..."` — same violation as the stylist input

**[preserve exactly]** `src/app/(auth)/sign-in.tsx:545` — native `AppleAuthenticationButton` `cornerRadius={px(26)}` — Apple's own button API, not a Cinch-authored capsule; radius likely constrained by Apple's HIG requirements for this control. Note the visual inconsistency next to the two violations above it, but do not "fix" a native platform button.

All other `rounded-full` usage checked (back buttons, avatars/monograms, progress tracks/fills, dots, mic/send circular buttons, skeleton placeholders) is correctly scoped to genuine 1:1 squares or thin bars with no text.

---

## 5. Border / hairline treatment drift

Two className tokens (`border-hairline`, `border-rule`) cover the majority of borders, but the choice between them is not governed by a legible rule — both appear on card edges, both appear on back-buttons, sometimes in the same file for the same visual role. Confirmed directly: **`src/app/event/[id]/index.tsx:488` uses `border-rule` and `:532` uses `border-hairline` for two structurally identical "board card" containers** on the same screen — **[fix inconsistency]**.

Beyond the className-level ambiguity, roughly a dozen sites bypass the className system with raw `style={{ borderWidth, borderColor }}`, introducing at least four different width values and two colors sourced outside `theme.hairline`/`theme.rule` — **[consolidate into component]** (fold these into the two className tokens, or formalize a third "heavy rule" token if 1.5/2/3px weights are intentional):
- `sign-in.tsx:563-564,616-617` — `borderWidth: 1`
- `dev-today.tsx:129-130`, `(tabs)/index.tsx:601-602` — `borderWidth: 1.5` (matched pair, dashed empty-state box)
- `today/plate.tsx:531-534` — `borderWidth: 1` (palette-dot ring)
- `ui/skeleton.tsx:93-94` — `borderWidth: 2` (spinner ring)
- `capture.tsx:35-38`, `dev-capture.tsx:56-59` — `borderWidth: 2`, `borderColor: theme.canvas` (capture-frame corner brackets — a camera-overlay context, lower priority)
- `capture.tsx:460`, `dev-capture.tsx:159` — `borderWidth: 3`, `borderColor: theme.canvas` (capture ring — a fifth distinct weight)
- `OutfitPostCard.tsx:478` — `borderColor: BLUSH_BORDER` (local constant — see §1, should be `theme.blushRule`)
- `plate-card.tsx:371` — `borderColor: INK.dotEdge` (separate export-canvas palette, lower priority — see §1)

`StyleSheet.hairlineWidth` is not used anywhere, confirming there is no shared canonical "1 device pixel" hairline outside the two className tokens.

---

## 6. Font-size / weight / letter-spacing outside the type scale

The shared `src/components/ui/text.tsx` component maps 1:1 to the tailwind `fontSize` tokens (plus three legitimate composite variants — `stat`, `statSmall`, `statFigure` — added because NativeWind gives no precedence guarantee when two `text-*` classes land on one element; the component's own comment documents this hazard). No `fontWeight` numeric literals exist anywhere in `src/` — every heavier-weight role correctly goes through `font-medium`/`font-semibold`, which resolve to `HelveticaNeue-Medium`. This category is otherwise clean.

**[fix inconsistency]** The documented `variant="stat"` + stacked `text-*` className anti-pattern (named in `text.tsx`'s own comment) still exists in two dev screens, even though it was fixed at every production call site:
- `src/app/dev-closet.tsx:138` — `<Text variant="stat" className="text-label" .../>` → should be `variant="statSmall"`
- `src/app/dev-screens.tsx:118` — `<Text variant="stat" className="text-figure" .../>` → should be `variant="statFigure"`

**[fix inconsistency]** `src/app/item/[id].tsx` `StatBox` (lines 635-644) — `variant="stat"` overridden inline with `fontSize: 28, letterSpacing: -0.15` — hand-reproduces the `figure`/`statFigure` token instead of using the `statFigure` variant that already exists for this exact case.

**[minor polish]** `src/app/item/[id].tsx:648-658` — `variant="colophon"` overridden to `fontSize: 8, lineHeight: 11, letterSpacing: 1.1` — none of the three values match any token (colophon is 10/14/1.4); a deliberate micro-size per its own comment, but the `letterSpacing: 1.1` matches neither the eyebrow (1.6) nor colophon (1.4) tracking family — should snap to one of the two.

**[fix inconsistency]** `src/app/dev-closet.tsx:71` — `fontSize: 15` on a search field — off-scale; the identical field was already fixed to 17 (`body`) at `closet.tsx:377` and `friends/index.tsx:200`, each with a comment noting "15 sat off the type scale entirely." This dev fixture was missed in that fix.

**[reject — systemic, same as §2's `sign-in.tsx` note]** The `sign-in.tsx` hero (lines ~435-576) renders through the same device-scaled `px()` helper for font sizes and letter-spacing (`px(34)`, `px(9.5)`, `px(10.5)`, `px(13)`, `px(29)`, `px(14)`, `px(14.5)`, plus tracked-caps `px(1.7)`/`px(1.6)` letter-spacing), producing values that don't land on 10/11/13/16/17/20/24/28/40/64 at any device width. The two "eyebrow"-style labels in the hero (`"Today's set"`, `"The Quiet Monday"`) are raw `RNText` with manual `textTransform:'uppercase'` rather than `variant="eyebrow"`, even though the same file correctly uses the shared `Text` component with named variants everywhere below the hero (lines 647-697). This is the single largest concentration of typography drift in the app — one file, one section, worth a dedicated pass rather than line items.

**Eyebrow/colophon tracking — otherwise clean.** All ~110 other `variant="eyebrow"`/`variant="colophon"` occurrences across the app consistently carry ls 1.6px/1.4px via the shared component. `src/app/(tabs)/_layout.tsx:57-58` — native tab-bar labels can't carry `letterSpacing` at all (`NativeTabsLabelStyle` has no such prop) — **[add missing state → reject, platform constraint]**: not fixable in this pass, flag as a known, permanent exception to the eyebrow-tracking rule.

---

## 7. Duplicated component patterns

`src/components/ui/` currently has: `Button` (`primary`/`secondary`/`ghost`), `Avatar`, `Chip`, `EmptyState`/`ErrorState`, `ScreenHeader`/`BackButton`, `Rule`, `Text`, `Skeleton`, `GhostedRail`. **No shared `Card`, `Row`, `Sheet`, or `SectionHeader` exists** — those four are hand-rolled at every call site.

### Ranked by call-site count

**1. Cards — ~35 call sites — [consolidate into component]**
`rounded-plate`/`rounded-card` (20px) + border + fill, hand-typed everywhere with inconsistent border weight (`border-rule` vs `border-hairline` vs none — see confirmed example in §5), fill (`bg-surface` vs transparent), and padding (`p-3`/`p-3.5`/`p-4`/`p-5`/none). Representative sites: `app/dev-profile.tsx:88,109,151`, `app/item/[id].tsx:294,405,504`, `app/review.tsx:270`, `app/event/[id]/index.tsx:488,532`, `app/borrow.tsx:76`, `app/friends/index.tsx:217,271,312,359`, `app/profile.tsx:362,375,429,502,520`, `app/(tabs)/index.tsx:330`, `app/(tabs)/explore.tsx:203,262,305,322`, `app/event/[id]/outfits.tsx:350,385`, `app/event/[id]/post.tsx:118,165`, `components/ingest/garment-search-sheet.tsx:127,267`, `components/events/EventCard.tsx:128`, `components/event-outfits/OutfitPostCard.tsx:328,425`, `components/events/VenueCard.tsx:30`, `components/review/review-card.tsx:300`, `components/today/plate.tsx:436`, `features/plan/packing-trip.tsx:231,283`, `features/plan/packing-tab.tsx:48`, `components/ui/skeleton.tsx:233` (the loading skeleton independently re-encodes the same card shape rather than deriving it). Recommend a `Card` primitive with `padding`/`bordered` props.

**2. Section headers — 59 raw `variant="eyebrow"` sites, ≥8 distinct spacing dialects — [consolidate into component]**
No wrapper exists; every screen sets its own margin around a bare eyebrow `Text`. Distinct top/bottom-margin combinations found in production code: no margin at all (majority — `dev-today.tsx`, `dev-share.tsx`, `profile.tsx:376`, `event/[id]/index.tsx:525,574`, `(tabs)/index.tsx:164,210`, `event/[id]/outfits.tsx:332`, `(tabs)/closet.tsx:520,566,800`, `(tabs)/explore.tsx:141`, `today/plate.tsx:523`, `garment-search-sheet.tsx:265,354,384`, `events/VenueCard.tsx:31`, `plan/packing-trip.tsx:186,263,284,308`, `plan/packing-tab.tsx:49`, `edit-profile-sheet.tsx:355`), `mb-2.5 mt-6` (`borrow.tsx:73`, `explore.tsx:200,259,319`, `friends/index.tsx:214,268`), `mb-2.5 mt-7` (`profile.tsx:426,499,517`, `friends/index.tsx:356`, `dev-profile.tsx:106,148`), `mb-3` (`dev-screens.tsx:43,54,78`, `item/[id].tsx:457,470`), `mb-3 mt-7` (`event/new.tsx:190,213,267,310,347`, `edit-profile-sheet.tsx:289,304`), `mb-1 mt-8` (`event/[id]/invite.tsx:204`), `mb-3 mt-4` (`(tabs)/plan.tsx:295`), `mb-2` (`plan/packing-trip.tsx:248`). Additionally the eyebrow-with-trailing-count sub-pattern is independently built twice with different wrapper markup: `(tabs)/closet.tsx:519` vs `event/[id]/outfits.tsx:331`. Recommend a `SectionHeader` component (`title`/`trailing` props) with one fixed vertical rhythm.

**3. Buttons — 9 hand-rolled "ink primary" sites + 9 byte-identical hand-rolled back buttons — [consolidate into component]**
The shared `Button`'s variant type has no `ink` option, so every screen needing a neutral-dark CTA reimplements it: `dev-today.tsx:155` (`rounded-md bg-ink px-6`), `(tabs)/closet.tsx:868-869` (`rounded-md bg-ink px-7 py-3`, **plus the raw-hex bug from §1**), `(tabs)/index.tsx:635` (`rounded-md bg-ink px-6`), `event/[id]/comments.tsx:270` (icon-only), `components/review/review-card.tsx:509` (`rounded-md bg-ink px-5`), `components/ingest/consent-sheet.tsx:131` and `components/social/social-terms-sheet.tsx:107` (both `rounded-plate bg-ink h-14` — near-identical to each other, differing from the `rounded-md` group above), plus two round-icon ink-fill variants (`(tabs)/index.tsx:179`, `dev-capture.tsx:215`). Divergent radius (`md` 12px vs `plate` 20px), height (`MIN_TAP_TARGET` vs fixed 48 vs `h-14`=56), and pressed-opacity (70/80/90). Recommend adding an `ink` variant to the existing `Button`.

Separately, `src/components/ui/screen-header.tsx` already exports a `BackButton` whose own docblock claims nine screens were migrated onto it — verified **none of the nine actually import it**; each hand-rolls the identical `h-9 w-9 rounded-full border-rule` + `chevron.left` size-15 + `hitSlop:8` circle: `app/borrow.tsx:110`, `app/friends/index.tsx:172`, `app/item/[id].tsx:258`, `app/event/new.tsx:175`, `app/friends/[userId].tsx:181`, `app/event/[id]/outfits.tsx:262`, `app/event/[id]/index.tsx:278`, `app/event/[id]/post.tsx:100`, `app/event/[id]/comments.tsx:145`. **This is the single lowest-risk consolidation in the audit** — the target component already exists, byte-identical, just not imported.

**4. Rows — 6 distinct implementations — [consolidate into component]**
`components/events/RosterRow.tsx` (uses shared `Avatar`/`Button` correctly) vs. `components/social/ProfileRow.tsx` (hand-rolled avatar, own `TODO(batch-1 seam)` comment) vs. a third inline avatar-row built directly in `app/event/[id]/invite.tsx:19,130-155` (same file that already imports `RosterRow` below it at line 208) vs. three separately-typed local row functions with the same "label + tone-colored chevron" shape but disagreeing chevron sizes and padding: `AccountRow` (`app/profile.tsx:101`, chevron 13, `px-4`), `SpecRow` (`app/item/[id].tsx:557`, chevron 13, `px-4`), `NavRow` (`app/event/[id]/index.tsx:98`, chevron **12**, no horizontal padding). Recommend one generic `Row` primitive with optional caption/hint/detail/divider props.

**5. Avatars — 4 hand-rolled sites, each already reconverged on an existing `Avatar` tone — [consolidate into component, lowest risk]**
`ui/avatar.tsx`'s own docblock claims four sites were migrated ("handled once, here"); verified only `EventCard.tsx` and `RosterRow.tsx` actually import it. Four sites still hand-roll it, and each is already a pure drop-in for an existing tone: `app/event/[id]/invite.tsx:19,130` → `<Avatar size={32} tone="sand">`; `components/social/ProfileRow.tsx:28,55` → `<Avatar size={44} tone="ink">`; `components/event-outfits/OutfitPostCard.tsx:86-105` (`InitialAvatar`) → `<Avatar size={28} tone="accent">`; `app/dev-profile.tsx:28,72` → `<Avatar size={56} tone="ink">`. No new API needed — pure migration.

**6. Sheets — 6-7 sites across 3 presentation mechanisms — [consolidate into component]**
`app/_layout.tsx:273-280` (native `formSheet`, `sheetCornerRadius: 38` — correctly uses the `sheet` token), `app/friends/[userId].tsx:253-269` (custom `Modal`+scrim, `rounded-t-sheet` correct, **no grabber**), `components/ingest/consent-sheet.tsx:60-90` (custom `Modal`+scrim, `rounded-t-plate` 20px — **wrong radius token for a sheet**, has a grabber), `app/capture.tsx:492`/`dev-capture.tsx:167,195` (in-page tray, same `rounded-t-plate` 20px look, not a real `Modal`), plus three independent `presentationStyle="pageSheet"` native-sheet copies (`garment-search-sheet.tsx:98`, `social-terms-sheet.tsx:64`, `edit-profile-sheet.tsx:157-162`). Corner radius correctly uses the `sheet` (38px) token in only 2 of the ~4 custom-sheet sites. Recommend a `HalfSheet` wrapper (scrim + `rounded-t-sheet` + grabber) for the custom-`Modal` cases.

**7. Empty states — well-consolidated, one outlier — [fix inconsistency, low priority]**
Nearly every list screen correctly uses the shared `EmptyState`/`ErrorState`. One outlier: `app/friends/index.tsx:330-334` — the "no friends yet" case is a bare `<Text variant="body" className="px-4 py-3.5 text-faint">` instead of `<EmptyState compact>`, which exists specifically for this "empty section inside an already-drawn container" case.

---

## 8. Shadow / elevation

Only three shadow "recipes" exist in the whole app (no `elevation:`/`boxShadow` usage found):

- **[consolidate into component]** **Contact shadow**, used twice: `today/plate.tsx:73,187,270-273` and `event-outfits/OutfitPostCard.tsx:29,192-195,222` — byte-identical `{dx:0, dy:5, blur:11, color:'rgba(28,26,22,0.16)'}`, declared independently in each file (see §1). Should be one exported `shadow.contact` value.
- **[fix inconsistency]** `components/share/plate-card.tsx:171-174` — pure-black (`#000000`, opacity 0.45) — inconsistent with the warm-ink family; should be `theme.ink` if visual parity with the in-app plate is intended (see §1).
- **[minor polish]** `app/capture.tsx:415` — `textShadowColor: 'rgba(0,0,0,0.55)'` — same pure-black outlier for a text shadow.

## 9. Icon sizing

Icons are exclusively `expo-symbols` `<SymbolView>` (no vector-icons/Feather/lucide anywhere). Full distribution: 10 through 76 across ~75 call sites. The **back-button chevron is perfectly consistent** (10 sites, all `size={15}` — the one genuinely-unified icon role in the app). Every other repeated role drifts — **[fix inconsistency]** for each:

- **Trailing row chevron** (`chevron.right`): `size={13}` (`dev-profile.tsx:57`, `profile.tsx:139-140`, `item/[id].tsx:595-596`, `ProfileRow.tsx:87-88`) vs `size={12}` (`event/[id]/index.tsx:127`) vs `size={11}` (`explore.tsx:290-291,353`) — three sizes for one role.
- **Overflow/ellipsis button**: `size={15}` (`friends/[userId].tsx:190`) vs `size={14}` (`OutfitPostCard.tsx:353-355`, `CommentRow.tsx:102`).
- **Sparkle/AI accent glyph**: `size={13}` (`dev-capture.tsx:73`) / `14` (`consent-sheet.tsx:115`) / `15` (`stylist.tsx:44`, `dev-stylist.tsx:57`) / `16` (`(tabs)/index.tsx:140`) — four sizes for the app's one recurring "AI feature" glyph.
- **Selection/checked indicator** (`checkmark.circle.fill`): `16` (`plan/day-row.tsx:88-90`) / `18` (`event/[id]/post.tsx:182-184`) / `22` (`components/closet/item-card.tsx:141-143`) — plausibly different contexts (planned-day vs attendee-select vs multi-select overlay), but worth a deliberate size-per-context rule rather than incidental drift.
- **[minor polish]** Chat send button (`arrow.up`): `17` (`stylist.tsx:415-417`, `dev-stylist.tsx:120-122`) vs `16` (`event/[id]/comments.tsx:276`) — 1px drift, low priority.

## 10. Animation durations vs. motion tokens

The spring system is clean: **every** `withSpring(...)` call in the app imports `spring` from `theme/tokens.ts` and passes a named preset — no inline `{duration, dampingRatio}` reimplementations were found anywhere. `motion.duration.slow` (380ms) is correctly used for the review-card swipe-away timing.

- **[fix friction — charter violation]** **`spring.bouncy` is used in two independent features, not "exactly once" as the charter requires**: `today/plate.tsx:121,164` (the plate-landing moment, split across the Reanimated and Skia rendering regimes for the same logical event — defensible as one sanctioned use) **and** `components/event-outfits/OutfitPostCard.tsx:239` (the "crown lands on the winning look" reveal). The `OutfitPostCard.tsx` code has a comment that reinterprets the rule as "the screen's single bouncy spring" — i.e. someone already noticed the tension and narrowed the rule's scope locally rather than following the literal charter text. This needs a decision, not a silent fix: either amend the charter's language to "once per moment-of-delight, not once globally," or remove the `bouncy` spring from the Crown reveal and use `spring.smooth`/`snappy` instead. Recording as a **fix friction** pending that decision, not a straightforward line fix.
- **[minor polish]** Four looping/pulse animations sit outside the `fast/base/slow` triad and don't reference any shared constant: `ui/skeleton.tsx:45` (1300ms shimmer sweep), `ui/skeleton.tsx:78` (800ms rotation), `ingest/upload-queue-list.tsx:41-42` (700ms ×2, opacity pulse). Three different loop speeds for what could be considered the same "busy/loading" affordance family — if a canonical loop duration is wanted, none of these currently reference it. Likely fine to leave as bespoke (looping ambient animation isn't the same category as `fast/base/slow` one-shot transitions), but flagged for a decision.
- **[add missing state]** `components/review/review-card.tsx` (swipe fly-off/snap-back) has no `useReducedMotion` guard, unlike `today/plate.tsx` and `OutfitPostCard.tsx`, which do gate their motion. The swipe-to-decide gesture is the single most physically prominent animation in the app (full-screen card flies off), making this the highest-priority missing Reduce-Motion guard. `ui/skeleton.tsx` and `upload-queue-list.tsx` loops are lower priority (ambient loading indication, less disorienting under Reduce Motion) but also unguarded.

---

## Consolidation plan — shared components worth extracting, ranked by call-site count

| Rank | Component | Call sites found | Effort | Notes |
|---|---|---|---|---|
| 1 | `Card` | ~35 | Medium | Doesn't exist at all; unify `border-rule`/`border-hairline`/none, `bg-surface`/none, and the 4 padding variants into `padding`/`bordered` props. |
| 2 | `SectionHeader` | 59 | Medium | Doesn't exist; ≥8 distinct margin dialects to collapse into one vertical rhythm, plus the eyebrow+trailing-count sub-pattern (2 sites). |
| 3 | `ink` Button variant | 9 hand-rolled + 9 identical unmigrated `BackButton` copies | Low | `Button` and `BackButton` **already exist** — this is largely an adoption pass, not new component design. The 9 `BackButton` sites are copy-paste-identical; lowest-risk fix in the whole audit. |
| 4 | `Row` | 6 (3 near-identical: `AccountRow`/`SpecRow`/`NavRow`) | Medium | Needs a props shape covering label/caption/hint/detail/divider/chevron-size before the three locals can merge. |
| 5 | `Avatar` adoption | 4 | Low | `Avatar` **already exists** with the exact tones needed (`sand`/`ink`/`accent`) — pure migration, no new API. |
| 6 | `HalfSheet` | 6-7 across 3 mechanisms | Medium-High | Requires deciding which sheets stay native (`pageSheet`/`formSheet`) vs. which are custom `Modal`+scrim — not a pure mechanical merge. |
| 7 | `EmptyState compact` adoption | 1 | Trivial | Already exists; one call site to fix. |
| — | `contrastTextOn(swatch)` helper | 3 | Low | Not a UI component but the same shared-logic problem — extract from `garment-cell.tsx`/`plate-thumb.tsx`/`new-addition-row.tsx` into `src/lib/color/`. |
| — | `shadow.contact` token | 2 (×3 uses each) | Low | Extract the byte-identical `CONTACT` constant from `plate.tsx`/`OutfitPostCard.tsx` into `src/theme/tokens.ts`. |

**Systemic items, not line-fixes:** `sign-in.tsx`'s parallel `px()` device-scaling system (spacing + type, §2/§6) and the `spring.bouncy` "exactly once" charter conflict (§10) both need a decision before any code changes, not a mechanical token swap.
