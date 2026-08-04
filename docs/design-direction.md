# CINCH — DESIGN DIRECTION & REWRITE BRIEF
**Aug 2026 · Expo SDK 57.0.10 / RN 0.86.2 / React 19.2.3 / NativeWind 4.2.6 (Tailwind v3) / iOS target 17.0**
Repo audited live at `/Users/nelsonsaenz/cinch` (71 source files). All package versions below verified against the npm registry today.

---

## 0. WHAT I ACTUALLY FOUND (the brief I was given was stale)

The research packet described a "navy/camel/cream/burgundy/charcoal" palette and implied the serif-clipping bug was unfixed. Neither is true of the shipping code:

- Accent is already **ultramarine `#1B3BFF`**, not navy — and `tailwind.config.js` already documents *why* (terracotta/amber reads as AI-generated). That call is correct. Keep it.
- `src/theme/font-metrics.js` already parses `hhea` out of the bundled TTFs and clamps every line height up to the font's floor. `leading('bodoni', 62, 1.06)` returns **95**, not 66. **The clipping bug is already fixed.** `scripts/typography-smoke.ts` even asserts it.

So the problem is not what the research assumed. The app is technically correct and aesthetically under-committed. Six specific weaknesses, all fixable, listed in §1.

---

## 1. VERDICT ON THE CURRENT DIRECTION

### Keep (non-negotiable)
| Asset | Why |
|---|---|
| **Bodoni Moda + Archivo** | Didone + grotesque is the literal formula of 20th-c. fashion publishing (Eye Magazine). Archivo is in the Trade Gothic lineage. Correct pairing, executed timidly. Don't change faces. |
| **`#FAF9F6` warm paper** | Premium-color research: no pure neutrals, warm = "editorial", cool = "technical". Correct. |
| **`#1B3BFF` ultramarine** | Genuinely un-generic. Verified **6.40:1** on canvas (AA at all sizes). |
| **`font-metrics.js` clamp** | Better engineering than most Figma design systems. Extend it, don't replace it. |
| **Wordmark "Cinch"** | User equity. It doesn't need replacing — it needs §1.2. |

### Weak — the six real problems

**1.2 The wordmark is rendering the wrong optical master.** `@expo-google-fonts/bodoni-moda` ships *static instances of a variable font* with `opsz` collapsed to its default of **11**. Your 62px wordmark is rendering the caption cut: thickened hairlines, loose spacing, low stroke contrast. This is the single largest "why does the didone look slightly cheap" lever in the app and it is a one-time build step. Second: your tracking is `−1.5px` at 62 (`−0.024em`). Apple's own serif, New York, tracks `−1.09` at 72pt (`−0.015em`). **You are 60% tighter than Apple's didone-adjacent curve on a face with higher contrast than New York** — you are crushing hairlines into each other.

**1.3 `garment-rail.tsx` is the weakest thing in the app, and it is the hero of the first screen.** Five flex-weighted color blocks in a tray. The code comment argues it "reads as an outfit." It does not — it reads as a **paint-chip palette**, because there is no caption, no scale reference, and no garment silhouette. It is also the one place in the app that shows no garment. That is the "more creative" itch the user can feel but hasn't named.

**1.4 The accent is sprayed, not spent.** `tailwind.config.js` says "exactly one accent carries every call to action." The code violates it: tab-bar icons (`theme.accent`), swap-note icon, envelope confirmation, ghost-button labels. HIG Color (iOS 26): *"If your app already has bright, colorful content in the content layer, prefer a monochromatic appearance for tab bars."* A grid of garment photos is exactly that.

**1.5 Motion is `.bouncy` globally.** `motion.spring = { damping: 18, stiffness: 180, mass: 0.9 }` → ζ = 18 / (2√(180×0.9)) = **0.707**, ωₙ = √200 = 14.14 rad/s ≈ SwiftUI `spring(duration: 0.44, bounce: 0.29)`. That is a consumer-app spring applied to everything. WWDC23 10158: *"When you're not sure, use a spring with bounce 0."* Luxury-web research: slow ease-out reads expensive, springy multi-property reads consumer.

**1.6 Radii are arbitrary literals, and one is provably wrong.** `card: 18` with `p-3` (12) containing `rounded-lg` (8). Apple's concentric rule is `inner = outer − inset` → should be **6**, not 8. There is no derivation anywhere; radii are typed by hand.

**1.7 Five tabs, one of which is a chat tab.** `Today / Closet / Stylist / Plan / Profile`. A top-level "Stylist" chat tab is the loudest generic-AI-app tell in the 2026 category, and it directly competes with Today for the same job. The Pratt critique of SSENSE names its **three** top-level labels as a primary strength.

### THE DIRECTION — commit to one: **THE PLATE**

> **Cinch is a printed lookbook that regenerates every morning. Every outfit is a numbered plate: a flat-lay on warm paper, under a didone title, over a tabular colophon of the exact data the engine reasoned about.**

Not "editorial-minimal" as an adjective. A **specific printed artifact** with rules: plate numbers, hairline rules, hard-left ragged-right setting, a visible measure, and a colophon line in tracked Archivo that states date, city, feels-like temperature, the occasion the user typed, the engine's actual color names, and the look's blended cost-per-wear.

**Why this one and not the alternatives:**

1. **It defends against "lazy minimalism"** — the failure mode Creative Boom names, and the one editorial-minimal actually collapses into. Whitespace with a visible grid, rules, and plate numbers is *structure*; whitespace without them is *absence*. This is the difference the user is sensing.
2. **It weaponises the only thing no competitor has.** Whering (10M users), Indyx and Acloset are organisational tools with pretty grids. None has an editorial *voice*, and none can produce `62°F · CAMEL / NAVY / CREAM · $1.40 / WEAR` because they don't compute it. Your `src/lib/color/oklch.ts`, `families.ts`, `harmony.ts` and `schemas/item.ts#costPerWear` already produce every number the colophon needs. **The differentiation is already in the database; it just isn't on screen.**
3. **It reuses your existing composition.** `outfit-card.tsx` already renders `flexGrow: g.visualWeight` flat-lays sorted by `LAYOUT_ORDER`. The plate is that component with typographic furniture around it — not a rebuild.
4. **It makes the app filmable.** Cal AI's real growth unit was a 3-second transformation a creator could film in one take with no narration. "Tap → a lookbook plate assembles" is that. "Tap → some cards appear" is not.
5. **It is Apple-legal.** HIG Branding: *"It can work well to use a custom font for headlines and subheadings while using a system font for body copy... Even a highly stylized interface can be approachable if it maintains familiar behaviors."* Unconventional typography + entirely conventional interaction. Spend the whole novelty budget on type, rules and data; spend zero on custom navigation.

**Rejected alternative:** the all-grotesque SSENSE direction (drop Bodoni, Archivo only at 40–64pt). Legitimate and I prototyped it mentally — SSENSE commissioned *Favorit Montreal*, a neo-grotesque, not a serif. Rejected because (a) the user explicitly likes the wordmark, (b) it throws away correct work to solve a problem that is actually `opsz`+tracking+trim, and (c) every AI-made "luxury" app reaches for a display serif *badly*; reaching for one *correctly* is more differentiating than avoiding it.

---

## 2. IS LIQUID GLASS RIGHT FOR THIS APP?

**Yes — on exactly four surfaces, monochrome, gated, and never in the content layer. It is chrome, not aesthetic.**

The instinct to reject it (Creative Boom lists Liquid Glass as "so over in 2026"; iOS 26 sat at ~15% adoption four months post-launch) confuses two different things. **Decorative glass** — glass cards, glass panels, glass over your paper canvas — is over, and would actively wreck this app. **Chrome glass** is not a trend; it is what the OS renders. Refusing it doesn't make you editorial, it makes you look like a web app in a shell.

Apple's own rule settles it. HIG Materials: *"Don't use Liquid Glass in the content layer... use standard materials for elements in the content layer, such as app backgrounds."* Your content layer is `#FAF9F6` paper and garment cutouts on `#F2F0EA` tray. **Apple is asking you to keep exactly what you already have.** iOS 26/27 makes your aesthetic *more* correct, not less.

### Where glass ships

| Surface | Style | Notes |
|---|---|---|
| Tab bar | `regular`, monochrome | Free via `NativeTabs` — do not hand-roll. Never set `backgroundColor`; it kills the system scroll-edge effect. |
| Today floating action capsule (`Wear it` / `Regenerate`) | `regular` + `GlassContainer spacing={24}` | The two buttons must merge into one piece of glass, not read as two blobs. `isInteractive` so it deforms under touch — that deformation *is* the tell. |
| `capture.tsx` shutter + controls | **`clear`** | The one legitimate `clear` use in the app: it floats over live camera media. HIG: `clear` is *only* for components over visually rich backgrounds. Add `rgba(0,0,0,0.35)` scrim if the frame is bright. |
| Item-detail scroll-edge, when the toolbar floats over a full-bleed garment hero | `regular` | One edge effect per view. Not decorative. |

### Where glass is forbidden

- **Anywhere on `bg-canvas`.** Glass over `#FAF9F6` refracts nothing and renders as a slightly grey, slightly dead rectangle. Glass needs rich content behind it.
- **The plate / outfit card.** The tray is the garment's ground truth; it must never tint or blur.
- **The closet grid cells.**
- **Any two glass surfaces stacked.** HIG: *"avoid overcrowding or layering Liquid Glass elements on top of each other."*
- **Tinted glass.** HIG Color: *"By default, Liquid Glass has no inherent color."* No `tintColor={accent}` on chrome. Monochrome only.

### Gating (mandatory — your floor is iOS 17.0)

`expo-glass-effect@~57.0.1` is **already in `package.json` and used nowhere.** Build one component and route everything through it:

```tsx
// src/components/ui/surface.tsx
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import { BlurView } from 'expo-blur';

// isGlassEffectAPIAvailable() is the RUNTIME check. isLiquidGlassAvailable() only
// tells you the binary was compiled with it — some iOS 26 betas crash on the former.
export const GLASS = isGlassEffectAPIAvailable();
```

Fallback path (iOS 17–25) is the **majority** path today: `<BlurView intensity={70} tint="light" />` under a `#FAF9F6` overlay at 0.62 opacity. Design the flat fallback first, then add glass. Known bug to preempt: `opacity: 0` on `GlassView` breaks rendering — animate `glassEffectStyle` between `'regular'` and `'none'` instead.

**Also raise `ios.deploymentTarget` from 17.0 → 18.0** in `app.config.ts`. Your audience is the SSENSE/Mytheresa crowd on recent hardware; it costs you almost nothing and unlocks Control Center controls and the App Intents surface later.

**QA matrix is four states, not one:** Liquid Glass slider at both extremes (new in iOS 27), Reduce Transparency ON, Increase Contrast ON.

---

## 3. THE TOKEN SYSTEM — EXACT VALUES

### 3.1 `src/theme/font-metrics.js` — add ascent/descent and `capTrim()`

The existing `FACES` table lacks the fields needed for optical trimming. Add them (values already parsed from the bundled TTFs, stated in your own comments):

```js
const FACES = {
  // BodoniModa: unitsPerEm 2000, hhea asc 2250 / desc -800 / gap 0, sCapHeight 1500
  bodoni:  { ascent: 1.125, descent: 0.400, leading: 1.525, capHeight: 0.750 },
  // Archivo: unitsPerEm 1000, hhea asc 878 / desc -210 / gap 0
  archivo: { ascent: 0.878, descent: 0.210, leading: 1.088, capHeight: 0.686 },
};

/**
 * Negative margins that collapse a line box down to its CAP HEIGHT.
 *
 * `leading()` guarantees the glyphs are not clipped. It does NOT give you an
 * editorially tight measure: a 64px Bodoni sits inside a 98px box, so a rule
 * placed 12px below "looks" 35px below. This is Capsize's cap-trim, for RN.
 *
 * Never fake this by lowering lineHeight — that is the clipping bug.
 */
function capTrim(face, fontSize, lineHeight) {
  const m = FACES[face];
  const half = (lineHeight - fontSize * m.leading) / 2;   // extra leading, split
  return {
    marginTop:    -Math.round(half + fontSize * (m.ascent - m.capHeight)),
    marginBottom: -Math.round(half + fontSize * m.descent),
  };
}
```

Verified output — the 64pt wordmark occupies exactly its 48pt cap height:

| face | size | lineHeight | marginTop | marginBottom | laid-out height |
|---|---|---|---|---|---|
| bodoni | 64 | 98 | **−24** | **−26** | **48** (= 0.75 × 64 ✓) |
| bodoni | 40 | 61 | −15 | −16 | 30 |
| bodoni | 28 | 43 | −11 | −11 | 21 |
| bodoni | 24 | 37 | −9 | −10 | 18 |

Extend `scripts/typography-smoke.ts` to assert `lineHeight + marginTop + marginBottom === round(fontSize × capHeight)` for every display token.

### 3.2 Type scale — `tailwind.config.js`

Tracking is not guessed. Bodoni uses **Apple's New York optical tracking curve** (24→−0.26, 28→−0.33, 34→−0.45, 48→−0.68, 72→−1.09, linearly interpolated), the only published Apple spec for a serif display face. Archivo uses the **SF Pro curve** up to 20pt and holds at −0.40 above it (SF Pro goes positive at ≥24pt for reasons specific to its design; Archivo is narrower and evener, and positive tracking there reads as a Canva template).

```js
fontSize: {
  // ── Bodoni Moda — DISPLAY ONLY, never below 24px ──
  wordmark: ['64px', { lineHeight: `${leading('bodoni', 64, 1.05)}px`, letterSpacing: '-0.95px' }], // 98
  display:  ['40px', { lineHeight: `${leading('bodoni', 40, 1.05)}px`, letterSpacing: '-0.55px' }], // 61
  title:    ['28px', { lineHeight: `${leading('bodoni', 28, 1.10)}px`, letterSpacing: '-0.33px' }], // 43
  plate:    ['24px', { lineHeight: `${leading('bodoni', 24, 1.10)}px`, letterSpacing: '-0.26px' }], // 37

  // ── Archivo ──
  figure:   ['28px', { lineHeight: `${leading('archivo', 28, 1.14)}px`, letterSpacing: '-0.40px' }], // 32
  heading:  ['20px', { lineHeight: `${leading('archivo', 20, 1.25)}px`, letterSpacing: '-0.45px' }], // 25
  body:     ['17px', { lineHeight: `${leading('archivo', 17, 1.50)}px`, letterSpacing: '-0.43px' }], // 26
  callout:  ['16px', { lineHeight: `${leading('archivo', 16, 1.50)}px`, letterSpacing: '-0.31px' }], // 24
  label:    ['13px', { lineHeight: `${leading('archivo', 13, 1.38)}px`, letterSpacing: '-0.08px' }], // 18
  caption:  ['11px', { lineHeight: `${leading('archivo', 11, 1.27)}px`, letterSpacing: '0.06px'  }], // 14
  // The tracked-out grotesque eyebrow. THIS is the fashion-magazine signature,
  // and it is the token the app is currently missing entirely.
  eyebrow:  ['11px', { lineHeight: `${leading('archivo', 11, 1.27)}px`, letterSpacing: '1.10px' }], // 0.10em
  colophon: ['10px', { lineHeight: '14px', letterSpacing: '0.90px' }],                              // 0.09em
},
```

Changes from current: `body` 16→**17** (Apple's iOS Body; every native control label is 17pt and 16 reads a half-step small next to them); 16 survives as `callout`. `wordmark` 62→64. New: `plate`, `callout`, `eyebrow`, `colophon`. Tracking loosened ~40% at display sizes.

**Hard rules:** never render Bodoni below 24px (didone dazzle — heavy stems dominate, hairlines vanish). Never ship text below 11px. `letterSpacing` is absolute points in RN, never em — recompute per size, never reuse a constant.

**Free win from left-alignment:** iOS applies kern *after* the final glyph, so centred tracked text sits ≈ `letterSpacing/2` left of true centre. Every headline in this direction is hard-left, so the bug disappears instead of needing a `marginLeft` fix.

### 3.3 Spacing — 4pt base, 8pt rhythm, 20pt gutter

```js
spacing: {
  hair: '1px',
  0.5: '2px',  1: '4px',   1.5: '6px',  2: '8px',   2.5: '10px',
  3: '12px',   4: '16px',  5: '20px',   6: '24px',  7: '28px',
  8: '32px',   10: '40px', 12: '48px',  14: '56px', 16: '64px',
  gutter: '20px',   // page margin — the measure
  rhythm: '8px',    // vertical baseline unit; all block gaps are multiples
  section: '28px',  // between plates
  tap: '44px',      // HIG floor, not a target
  bezel: '12px',    // HIG: padding around BEZELED controls (chips, buttons)
  bare: '24px',     // HIG: padding around UNBEZELED controls (bare icons, links)
},
```

HIG Accessibility, verbatim: *"about 12 points of padding around elements that include a bezel. For elements without a bezel, about 24 points."* Those are `bezel` and `bare`. Currently every gap in the app is `gap-2` (8) regardless — filter chips at 8pt apart fail this.

The measure, for the grid argument (add to `tokens.ts`, not Tailwind — it's runtime):

```ts
// 6 columns, 20pt gutters, 8pt column gaps. On a 393pt iPhone:
// col = (393 − 40 − 5×8) / 6 = 52.17pt
export function useGrid() {
  const { width } = useWindowDimensions();
  const col = (width - 2 * 20 - 5 * 8) / 6;
  return { col, span: (n: number) => n * col + (n - 1) * 8 };
}
```
Full-bleed images span 6. Plates span 6. The colophon spans 4. Never centre a text block.

### 3.4 Corner radii — concentric

Apple: *"the shape of the hardware informs the curvature... rounded shapes that are concentric to their containers."* `ConcentricRectangle` / `.containerConcentric()`. The math is `inner = outer − inset`.

**Anchor the ladder at the plate, not the device bezel.** A card inset a full 20pt gutter from a 55pt device corner would derive to 35pt, which is a wellness app, not a lookbook. Concentricity applies to containers you can *see*.

```js
borderRadius: {
  none: '0px',
  xs:  '2px',   // thumbnail inside a 8pt inner at 6pt inset
  sm:  '4px',
  DEFAULT: '8px',   // plate inner: 20 − 12 (p-3) = 8   ← currently wrong at 8 by luck, right by derivation
  md:  '12px',      // buttons, fields, chips-that-aren't-pills
  lg:  '16px',
  plate: '20px',    // outfit plate, item card
  sheet: '38px',    // half sheets, iOS 26 inset from screen edge
  screen: '55px',   // iPhone 15/16/17 physical corner — reference for full-bleed only
  full: '9999px',   // GLASS CHROME ONLY
},
```

```ts
// src/theme/tokens.ts — forbid literal radii in components
export const concentric = (outer: number, inset: number) => Math.max(outer - inset, 0);
```

**The one aesthetic call inside this:** move content-layer buttons and text fields off the pill (`rounded-chip` 999) onto **`md` = 12px**. Including `AppleAuthenticationButton cornerRadius={999}` → `12`. Pills are a consumer-app signature; SSENSE, Mytheresa and Vestiaire use rectangles or near-rectangles. Capsules survive **only on the glass chrome layer**, where they're the OS's shape, not yours. That rule is both HIG-consistent and brand-consistent, which is exactly the tension you want resolved.

### 3.5 Colour — three columns, not one

HIG: *"If you define a custom color, make sure to supply light and dark variants, **and an increased contrast option for each variant**."* You ship two. Add the third.

All ratios below computed against WCAG relative luminance, not eyeballed:

| Token | Light | Light-HC | Dark | Dark-HC |
|---|---|---|---|---|
| `canvas` | `#FAF9F6` | `#FFFEFB` | `#141310` | `#0A0906` |
| `surface` | `#FFFFFF` | `#FFFFFF` | `#1E1C18` | `#26241F` |
| `tray` | `#F2F0EA` | `#EDEAE2` | `#26241F` | `#2E2B25` |
| `ink` | `#141310` | `#0A0906` | `#FAF9F6` | `#FFFDF8` |
| `muted` | `#6B665C` **5.42:1** | `#4A463D` **8.92:1** | `#9C968A` **6.32:1** | `#C4BEB0` |
| `hairline` | `#E3E0D8` (1.25:1 — a whisper, correct) | `#C9C4B8` | `#33302A` | `#4A463D` |
| **`rule`** *(new)* | `rgba(20,19,16,0.18)` | `rgba(20,19,16,0.34)` | `rgba(250,249,246,0.20)` | `rgba(250,249,246,0.38)` |
| `accent` | `#1B3BFF` **6.40:1** | `#0A28D6` **8.72:1** | `#5C74FF` **4.77:1** | `#93A4FF` |
| `positive` | `#2E7D4F` | `#1F6640` | `#4CAF7D` | `#6FCB9C` |
| `warning` | `#B4741F` | `#8F5A12` | `#D9932F` | `#EFB04F` |
| `critical` | `#B3261E` | `#8C1A14` | `#E5675E` | `#F58C84` |

**Everything currently in the palette passes AA.** Don't change it. Two additions matter:

- **`rule`** — `hairline` at 1.25:1 is right for a divider and too faint to carry the lookbook's structural rules. `rule` is ink at 18% so it composites correctly over canvas *and* tray without a second token. This is the workhorse of the whole direction.
- Dark `accent` `#5C74FF` at **4.77:1** clears AA by 0.27. It is your thinnest margin in the system. Never put it under 17pt, and never on `surface-dark` (`#1E1C18`) — that drops to ~4.4:1 and fails. Flag it in `tokens.ts`.

**Resolve the dark-mode contradiction.** `.impeccable.md` says *"Light theme, always"*; `tokens.ts` and every component ship a full dark ramp. The code is right and the doc is wrong: HIG Color, verbatim — *"Even if your app ships in a single appearance mode, provide both light and dark colors to support Liquid Glass adaptivity."* Glass inverts against underlying content and will expose a missing dark variant. Fix the doc.

**Paper, not flat.** `#FAF9F6` with nothing on it is the "lazy minimalism" failure. Ship one Skia noise shader at ~2.5% opacity over the canvas — a `<Paper/>` wrapper in the root layout. One shader, near-zero cost, and it reads as printed stock instead of default RN white. This is Phase 3, not blocking.

### 3.6 Motion — replace physics params with SwiftUI-isomorphic duration/dampingRatio

Reanimated 4.5's `duration` + `dampingRatio` is the only RN spring API numerically isomorphic to SwiftUI's `spring(duration:bounce:)` (`dampingRatio = 1 − bounce`), and the docs confirm the same perceptual-duration model from WWDC23 (*"Actual duration is 1.5 times the value"*). Transcribe Apple's numbers instead of inventing yours.

```ts
// src/theme/tokens.ts — replaces motion.spring / motion.springSoft
export const spring = {
  smooth:      { duration: 500, dampingRatio: 1.00 },  // SwiftUI .smooth — the DEFAULT
  snappy:      { duration: 450, dampingRatio: 0.85 },  // SwiftUI .snappy — buttons, chips
  bouncy:      { duration: 500, dampingRatio: 0.70 },  // SwiftUI .bouncy — ONE moment in the app
  interactive: { duration: 150, dampingRatio: 0.86 },  // gesture release, drag snap-back
} as const;

// Non-spatial ONLY: opacity, colour. A spring on opacity looks wrong.
export const fade = { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) };

export const stagger = 60;
```

`spring.smooth` is the default for plates, sheets and screen content. `snappy` for controls. **`bouncy` is used exactly once in the entire app** — the final garment landing in the plate assembly (§6). `withSpring(v, { ...spring.x, reduceMotion: ReduceMotion.System })` always.

`maxFontSizeMultiplier`: current 1.4 display / 1.8 body is correct — keep. Never globally disable `allowFontScaling`.

---

## 4. DEPENDENCY LIST

Already installed and correct — no change: `expo-glass-effect ~57.0.1` (installed, **unused**), `@expo/ui ~57.0.9` (installed, **unused**), `@shopify/flash-list 2.0.2`, `expo-symbols`, `expo-haptics`, `expo-image`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `expo-dev-client 57.0.10`.

### Add now (Phase 1–2)

| Package | Version | Install | Expo Go | New Arch | Notes |
|---|---|---|---|---|---|
| `react-native-view-shot` | **5.1.1** | `npx expo install react-native-view-shot` | ✅ | ✅ (Fabric+TurboModules from v4) | Expo ships a first-party doc page (`docs.expo.dev/versions/latest/sdk/captureRef`). The share-card pipeline needs **zero** native work. |
| `expo-sharing` | **~57.0.8** | `npx expo install expo-sharing` | ✅ | ✅ | System share sheet. Always-available fallback. |
| `expo-blur` | `~57.0.x` | `npx expo install expo-blur` | ✅ | ✅ | Mandatory iOS 17–25 glass fallback. |
| `expo-router/unstable-native-tabs` | (in `expo-router 57.0.10`) | — | ❌ | ✅ | **Needs dev build.** See risk note below. |

### Add later (Phase 3–4)

| Package | Version | Expo Go | Notes |
|---|---|---|---|
| `@shopify/react-native-skia` | **2.10.1** | ❌ dev build | Paper grain shader + optional pixel-exact share-card renderer. Use `npx expo install` so Expo pins the SDK-57-tested build. |
| `react-native-screen-transitions` | **3.11.2** | ✅ (pure Reanimated) | Closet-tile → item-detail shared element. Officially blogged by React Navigation, Apr 2026. |
| `@bacons/apple-targets` | **5.0.0** | ❌ prebuild | "Today's Fit" WidgetKit widget + the `What should I wear?` App Intent. Requires CocoaPods 1.16.2 / Xcode 16+ (you're on 26 ✓). SwiftUI — budget real Swift time. |
| `expo-share-intent` | **8.0.1** (SDK 57 line) | ❌ dev build | iOS Share Extension — "Add to Cinch" from SSENSE/Vestiaire/Mytheresa. Highest-ROI native surface nobody in the category ships. |

### Build-time only, not a runtime dependency

**`fonttools`** (Python). Instance Bodoni Moda at the display optical size and drop the Google-Fonts static cut:

```bash
pip install fonttools
fonttools varLib.instancer 'BodoniModa[opsz,wght].ttf' wght=600 opsz=96 \
  -o assets/fonts/BodoniModa-Display-SemiBold.ttf
fonttools varLib.instancer 'BodoniModa[opsz,wght].ttf' wght=400 opsz=96 \
  -o assets/fonts/BodoniModa-Display-Regular.ttf
```
Register via `useFonts({ 'BodoniModa-Display-SemiBold': require(...) })` in `src/app/_layout.tsx` and point `fontFamily.display` at it. **Remove `@expo-google-fonts/bodoni-moda`.** OFL 1.1 with no Reserved Font Name permits modification and bundling; ship `OFL.txt` in `assets/fonts/`.

### Explicitly NOT installing
`@react-native-community/blur` (repo deleted — a lot of AI-generated code still references it), `@callstack/liquid-glass` (redundant with `expo-glass-effect`, no Expo Go, lacks the `isGlassEffectAPIAvailable` crash guard), `zeego` (last release 2025-03-21, stale against RN 0.86 — `ContextMenu` from `@expo/ui/swift-ui` is already installed and first-party), `sonner-native` (web-neutral, needs a full restyle to not read generic), `react-native-reusables` / `nativewindui` (would fight `src/components/ui/`, which is already better), `burnt` (last push 2025-12-15, untested on RN 0.86).

### Risk: `unstable-native-tabs`

`AGENTS.md` deliberately avoided it. **I'm overruling that,** with mitigation:
- It is the single loudest native signal in the app, and Liquid Glass + minimize-on-scroll are unfakeable in JS.
- Blast radius is **one file** (`src/app/(tabs)/_layout.tsx`). A breaking minor is a one-file fix.
- It has soaked three SDKs (alpha 54 → compound API 55 → selected icons 56 → 57).
- Mitigation: pin `"expo-router": "57.0.10"` (drop the `~`), and keep the current JS implementation verbatim at `src/app/(tabs)/_layout.js-tabs.bak` with a pointer comment.

**iOS 26 gotcha, from Expo's own docs:** style `NativeTabs` icons/labels with `DynamicColorIOS` or `PlatformColor`, **never plain hex** — hex causes dark-mode flicker on the glass bar. Your `useTheme()` returns hex strings, so this needs a `DynamicColorIOS({ light, dark })` wrapper in `tokens.ts`.

---

## 5. REWRITE ORDER — file-level, highest visual impact first

### Phase 0 — foundation (no visible change, everything depends on it)
1. **`src/theme/font-metrics.js`** — add `ascent`/`descent` to `FACES`, add `capTrim()`. Export both.
2. **`scripts/typography-smoke.ts`** — assert `lineHeight + top + bottom === round(size × capHeight)` for `wordmark`/`display`/`title`/`plate`.
3. **`assets/fonts/`** — instanced `BodoniModa-Display-{Regular,SemiBold}.ttf` at `opsz=96`. Update `src/app/_layout.tsx#useFonts`. Remove `@expo-google-fonts/bodoni-moda` from `package.json`.
4. **`tailwind.config.js`** — §3.2 type scale, §3.3 spacing, §3.4 radii, `rule` + HC colours.
5. **`src/theme/tokens.ts`** — `spring`/`fade` per §3.6, `concentric()`, `rule`, `useGrid()`, HC palette, `dynamic()` → `DynamicColorIOS`.
6. **`src/components/ui/text.tsx`** — new variants `plate`, `callout`, `eyebrow`, `colophon`; auto-apply `capTrim` to `wordmark`/`display`/`title`/`plate` via `style`; add `optical={false}` escape hatch.

### Phase 1 — the three screens that matter
7. **`src/components/auth/garment-rail.tsx` → `src/components/brand/plate-hero.tsx`** *(highest single-change impact)*. Kill the abstract five-block rail. Replace with a real **Plate 01**: five hand-art-directed garment cutout PNGs shipped at `assets/plates/01/*.png` (do not wait on runtime background removal — the first screen deserves art direction, not an approximation), flex-weighted by `visualWeight`, on `tray`, `rounded-plate` (20), `p-3` → inner `8`. Beneath it, a 1px `rule` at 100% measure, then the colophon in `colophon` type: `PLATE 01 · NAVY / CAMEL / CREAM / BURGUNDY / CHARCOAL`. That single caption line is what converts "paint chips" into "lookbook legend." Assembly on `spring.smooth`, `stagger: 60`, `useReducedMotion()` respected (keep the existing guard — it's correct).
8. **`src/app/(auth)/sign-in.tsx`** — restructure to a masthead. `CINCH` at `wordmark` (64), **hard-left at the gutter, not `text-center`** (centred hero text is a named AI-slop tell); rule directly under it at the cap-trim baseline; eyebrow `NO. 01 — THE MORNING EDIT`; tagline left-aligned in `body` (17). Plate hero below. Drop `flex: 0.7 / 0.5` spacers for explicit `rhythm` multiples. `AppleAuthenticationButton cornerRadius={999} → 12`; height `54 → 52`. Email field `rounded-chip → rounded-md`. **Bug: remove `autoComplete="email"`** — RN docs: *"Avoid using both `textContentType` and `autoComplete`"*; `textContentType` wins, and the pair is what summons the generic Passwords AutoFill key. Keep `textContentType="emailAddress"`. Never use `textContentType="username"`.
9. **`src/app/(tabs)/_layout.tsx`** — `NativeTabs` from `expo-router/unstable-native-tabs`. **Three tabs: Today / Closet / Plan.** Kill `Stylist` as a tab (a chat tab is the generic-AI tell and duplicates Today's job) — it becomes a sheet from the Today toolbar and from any plate. Kill `Profile` as a tab → trailing nav-bar avatar on Today. `minimizeBehavior="onScrollDown"`. **Monochrome** `tintColor` = `ink`, inactive `muted` — no accent on chrome. Filled SF Symbols for selected via the `{ default, selected }` object. **No `backgroundColor`** — it kills the scroll-edge effect. `labelStyle` → Archivo 11, colour split per state (`{ default: muted, selected: ink }`). *(Amended after implementation: the brief asked for `+1.10` tracking to match `eyebrow`, but `NativeTabsLabelStyle` exposes no `letterSpacing` — the native bar's labels ride untracked.)*
10. **`src/components/today/outfit-card.tsx` → `src/components/today/plate.tsx`** — the app's signature component:
    - `eyebrow`: `PLATE 0{n} — {occasion}` in tracked Archivo.
    - Flat-lay: `rounded-plate` (20) / `p-3` (12) → inner **8** (currently `rounded-lg` 8 by coincidence; derive it via `concentric(20, 12)`). Height `190 → 236` (1.5:1 on a 353pt measure — Baymard: luxury/fashion earns larger images).
    - Bodoni **`plate`** (24) title under it, cap-trimmed.
    - 1px `rule`.
    - **Colophon**, `colophon` type, tabular figures: `{DATE} · {CITY} · {FEELS}° · {COLOR NAMES} · ${CPW}/WEAR`. Every value already exists in `context.weather`, `g.colors[0].name`, `costPerWear`. **This line is the product.**
    - Contact shadow under each cutout (warm `#141310` @ 8%, `shadowRadius: 8`, `offsetY: 4`) — the cheapest change that makes a user's bed-photo cutout read as a studio ghost-mannequin shot.
    - `Wear it` button 12pt radius; reaction bar hit targets to 44 via `hitSlop`.
11. **`src/app/(tabs)/index.tsx`** — `Today` masthead at `display` (40), left, cap-trimmed, with the date as `eyebrow` above it and a rule below. Move `Wear it` / `Regenerate` off each card into **one floating `GlassContainer`** capsule pinned to the bottom safe area (`spacing={24}`, `isInteractive`), gated by `GLASS`. Exactly **one** scroll-edge treatment on this screen — HIG: *"Apply one scroll edge effect per view."* Note input `rounded-chip → rounded-md`.
12. **`src/components/ui/button.tsx`** — `rounded-chip → rounded-md` (12) for content-layer; add a `capsule` variant reserved for glass chrome. `bg-tray` secondary → `bg-transparent border border-rule`. Haptics vocabulary: `selectionAsync()` for discrete steps, `impactAsync(Soft)` for garment pick-up/drop, `impactAsync(Rigid)` for snap, `notificationAsync(Success)` exactly once — on outfit generation. **Never `Heavy`** in a styling app; it reads as an error.

### Phase 2 — the artifact
13. **`src/components/share/plate-card.tsx`** *(new)* + **`src/features/share/capture-plate.ts`** *(new)* — see §6.
14. **`src/app/(tabs)/closet.tsx` + `closet-grid.tsx` + `item-card.tsx`** — keep 2 columns (Baymard: 2 on mobile, one documented A/B at +12% conversion; and no user-facing density toggle — best-in-class removed theirs). Add `masonry` + `overrideItemLayout` so statement pieces span 2 and the grid gets editorial rhythm instead of uniform tiling. Contact shadow. Filter chips: `bezel` (12pt) gaps, not `gap-2`. Category icons — author them as real custom SF Symbols (Figma "SF Symbol Generator" → Xcode asset catalog → consumed through `expo-symbols`) so `blazer` / `loafer` / `trench` inherit weight and optical alignment from the system instead of sitting next to it looking foreign.
15. **`src/components/ui/empty-state.tsx`** — delete the centred 80pt circle + icon (badge-above-headline / centred-illustration is a named slop tell). Replace with the **real closet grid rendered at 8% opacity** — ghosted garment silhouettes in the exact cells the user's items will occupy — plus one hard-left Bodoni line and one action. The empty state literally *is* the filled state, which teaches the grid and needs zero illustration.

### Phase 3 — texture and depth
16. **`src/components/ui/paper.tsx`** *(new)* — Skia grain shader at 2.5% over canvas, mounted once in `src/app/_layout.tsx`.
17. **`src/app/item/[id].tsx`** — scaling hero header (Exyte `ScalingHeaderScrollView` pattern, reimplemented with `useAnimatedScrollHandler` + `interpolate`). Single highest-impact layout move for an editorial feel on a detail page.
18. **`src/components/stylist/*`** — Stylist becomes a `BottomSheet` from `@expo/ui/swift-ui` (already installed, native detents) rather than a tab.
19. **`src/app/capture.tsx`** — `clear` glass controls over the camera feed. The only `clear` in the app.

### Phase 4 — surfaces
20. `@bacons/apple-targets` → "Today's Fit" widget + `What should I wear?` App Intent (one Swift file lights up Siri, Spotlight, Action Button, Control Center and the widget).
21. `expo-share-intent` → "Add to Cinch" from the share sheet.

---

## 6. THE ONE MEMORABLE THING — **THE PLATE**

**Two halves: an in-app moment and an exportable artifact. Same component.**

### The moment (3 seconds, filmable in one take, no narration)

When an outfit resolves on Today:

| t | Event | Motion |
|---|---|---|
| 0ms | Plate ground (`tray`) fades in | `fade` 380ms |
| 120ms | Garments land in `LAYOUT_ORDER` (outer → core → feet), 60ms stagger | `spring.smooth`, `translateY 18 → 0`, `scaleY 0.94 → 1` |
| ~460ms | **Final garment lands** | `spring.bouncy` — the *only* bounce in the app — + `Haptics.impactAsync(Soft)` |
| 520ms | Rule draws left → right | `withTiming(1, fade)` on `scaleX`, `transformOrigin: left` |
| 600ms | Bodoni plate title fades up | `FadeInDown` 380ms |
| 700ms | Colophon reveals left → right, character-band by character-band | `stagger 24` per segment |

That is the transformation a creator films. Cal AI reached ~$50M ARR on a 3-second demoable transformation seeded to 250 creators — not on an invite loop. This is Cinch's.

### The artifact — 1080 × 1920

Long-press the plate number → renders an off-screen `<PlateCard/>` and opens the system share sheet.

```tsx
// src/features/share/capture-plate.ts
import { captureRef } from 'react-native-view-shot';
import { PixelRatio } from 'react-native';
import * as Sharing from 'expo-sharing';

const R = PixelRatio.get();                 // 3 on every modern iPhone
export const CARD = { w: 1080 / R, h: 1920 / R };   // 360 × 640 logical points

const uri = await captureRef(ref, {
  format: 'png', quality: 1, result: 'tmpfile',
  width: CARD.w, height: CARD.h,            // ← logical, NOT 1080/1920
});
await Sharing.shareAsync(uri, { UTI: 'public.png', mimeType: 'image/png' });
```

**The `PixelRatio` division is the step everyone gets wrong and it is why most RN share cards ship blurry.** Passing `1080` directly asks for a 3240px-wide capture.

Layout on the 360 × 640 logical canvas (Instagram Stories overlays roughly the top and bottom 250px of 1920 → **y = 83 … 557** in logical points):

```
y=  90   CINCH            Bodoni display 28, cap-trimmed, x=32
y= 112   ────────────────  1px rule, full measure (x=32 → x=328)
y= 122   THE MORNING EDIT  eyebrow 11 / +1.10 tracking, muted
y= 160   ┌──────────────┐  plate: 296 × 197, tray, rounded-plate 20, p-3
         │  flat-lay    │  garment cutouts, flexGrow = visualWeight,
         └──────────────┘  warm contact shadow under each
y= 380   Quiet authority.  Bodoni plate 24, cap-trimmed, left
y= 404   ────────────────  1px rule
y= 414   4 AUG 2026 · BROOKLYN · FEELS 62° · DINNER AT 7
y= 428   CAMEL / NAVY / CREAM / BURGUNDY
y= 442   $1.40 / WEAR · 5 PIECES · 47 WEARS LOGGED
                            ↑ colophon 10 / +0.90, tabular figures
y= 517   CINCH · cinch.app  Archivo eyebrow, bottom-CENTRED (only centred
                            element in the design — it's a colophon, not copy)
```

### Why this is the right signature and not something else

1. **It satisfies the wrapped contract without waiting for December.** Spotify Wrapped: about the user, superlative, pre-formatted 9:16, small bottom-anchored branding. This is that, **continuous** — a shareable moment every morning instead of once a year.
2. **It carries data no competitor can fake.** `costPerWear`, `oklch` colour names, `feelsLikeC`, the occasion the user typed. Whering and Indyx have prettier grids and cannot produce this line, because they don't compute it. Your `src/lib/color/` and `src/lib/styling/score.ts` already do.
3. **Zero new ML, zero new native code.** `react-native-view-shot` 5.1.1 is Expo-Go-compatible and Fabric-safe. You can ship the entire feature without a dev build.
4. **It is the same component as the in-app plate.** One design, two renderers.
5. **Free forever, for everyone, including lapsed users.** Strava paywalled Year in Sport in Dec 2025 and converted its largest annual organic acquisition event into a churn event. **Monetise the styling; never the shareable.**
6. **It earns the one review prompt you get.** `SKStoreReviewController` shows at most 3× per user per 365 days and gives you no callback. Fire `expo-store-review` **once**, immediately after the first successful plate share. Never on launch, never after an error.

**Migrate the renderer to Skia (`makeImageSnapshot` on an offscreen surface) only if QA shows Bodoni rasterising differently across devices.** `view-shot` inherits platform text rasterisation and is explicitly "not pixel perfect"; Skia is deterministic at exactly 1080 × 1920. Start with view-shot. Never mix the two in one capture — view-shot cannot capture a Skia canvas.

---

## 7. WHAT TO REJECT

### Tooling / pipeline
- **Figma Professional Dev seat ($12/mo), Style Dictionary v5.5.0, Tokens Studio, DTCG `.tokens.json`, the `create_design_system_rules` prompt, `generate_figma_design`.** Rejected wholesale. You have one token author and two consumers (`tailwind.config.js`, `tokens.ts`). `font-metrics.js` is a better design system than most Figma libraries because it is derived from font binaries rather than transcribed. A build step to sync two files in one repo is ceremony. Revisit the instant a second designer joins. **Do still download the free iOS 27 Figma kit** (`figma.com/community/file/1651309003795292092`) as a *ruler* — measure the tab-bar capsule, the 21pt inset, the sheet radius — and hard-code the numbers. That is a one-afternoon task, not a pipeline.
- **Sketch.** Apple ships it first and it is not dead software, but no MCP, no Code Connect, no token export. Ignore the Sketch downloads on Apple's page.
- **Locofy / Builder.io / Anima.** Anima especially — absolute positioning, flat structure, "a screenshot rebuilt in HTML."
- **`figma-developer-mcp` (15.6k stars).** It feeds an agent pixel geometry, which produces *exactly* the generic AI output this project exists to escape.
- **Mobbin MCP paid plan.** Genuinely good, but not a prerequisite. Buy it when you're stuck on a specific screen, not to start.
- **`awesome-ios-design-md`.** No fashion-retail coverage at all. Its `DESIGN-expo.md` *schema* is worth stealing; its content isn't.

### Design ideas
- **New York as a companion serif.** It's Apple's face. Using it makes Cinch look like Apple News, not like Cinch. Two families, and Archivo already covers 17–22pt cleanly.
- **Liquid Glass anywhere in the content layer.** Glass cards, glass panels, glass on paper. Apple's own rule, and it's also the trend everyone is tired of.
- **Tinted / accent-coloured glass chrome.** HIG Color: glass has no inherent colour.
- **`Link.AppleZoom` (Expo Router zoom transition).** Apple's real Photos morph, but Expo's own docs state a **~1 second delay opening and dismissing**, header glitches, incompatibility with modals, and a silent no-op on iOS 17. That is disqualifying for closet-tile → item-detail, the single most-performed interaction in the app.
- **Reanimated Shared Element Transitions.** Still behind `ENABLE_SHARED_ELEMENT_TRANSITIONS` in Reanimated 4 and explicitly not production-recommended.
- **App Clips.** The 50–100MB limit finally makes an RN clip buildable, but clips pay off at physical points of sale. A closet has none. Revisit only for an in-store boutique activation.
- **Live Activities.** For time-bounded events. A wardrobe has none.
- **Bento grids, rows of three equal rounded cards, centred hero copy, badge-above-headline, numbered 1-2-3 onboarding, thin-line generic icons, any gradient, any purple or indigo, Inter, Roboto.** The full slop fingerprint. Ban list, enforced in code review.
- **A user-selectable 2/3/4-column density toggle.** Best-in-class e-commerce deliberately removed theirs.

### Growth
- **Streaks, daily-log gamification, invite loops, referral programs.** All of it, until week-4 retention visibly flattens. Casey Winters: virality is a multiplier on retained users, not a substitute. Shipping share mechanics into a leaky bucket produces low-intent installs that crater day-30 and your rating — and a 0.3-star drop correlates with ~19% higher CPI. Streaks are also actively wrong for this product: penalising someone for repeating an outfit is hostile to people with taste. **The plate share and the widget are the exceptions** — they are growth mechanics *and* product quality simultaneously, which is why they're in Phase 2 and 4 and nothing else is.
- **Dropbox-style double-sided referral.** Apple rejects schemes rewarding the *recipient* for downloading. Guideline 3.2.2(x) also forbids gating functionality on shares. If you ever build referral: reward the sender only, never gate a core closet feature.
- **BeReal-style forced daily posting.** 73.5M → 23M actives. Virality without a compounding asset is a liability. Cinch's compounding asset is the closet.

### Libraries
`sonner-native` · `zeego` (stale, and `@expo/ui/swift-ui` `ContextMenu` is already installed) · `burnt` · `nativewindui` (last commit 2025-10-08, predates SDK 56/57 and the entire glass wave) · `react-native-reusables` (would fight `src/components/ui/`, which is already better than shadcn's defaults for this brand) · `@callstack/liquid-glass` · `@react-native-community/blur` (repo deleted) · `jondot/awesome-react-native` (last pushed 2024-07-05) · Untitled UI · Tamagui · `legend-list` (FlashList v2 already installed and correct for uniform cells).

---

## 8. THE THREE RULES THAT KEEP THIS FROM DRIFTING BACK

Put these at the top of `AGENTS.md` — which currently contains one line and is doing no work:

1. **Custom faces above 24pt, system-legible faces below. Zero exceptions.** Bodoni never renders under 24px. Archivo never renders under 11px.
2. **Novelty budget is spent entirely on type, rule, colour and photography. Every gesture, bar, sheet and menu is the stock component.** HIG Branding: *"Even a highly stylized interface can be approachable if it maintains familiar behaviors."*
3. **One coloured background per screen — the primary action. Everything else is `ink` or `muted`.** Never tint a symbol or text to signal prominence; tint the background. Chrome is always monochrome, because the content layer is already full of colour: the user's clothes.

---

**Sources:** [Apple HIG — Materials](https://developer.apple.com/design/human-interface-guidelines/materials) · [Adopting Liquid Glass](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass) · [HIG — Typography](https://developer.apple.com/design/human-interface-guidelines/typography) · [HIG — Color](https://developer.apple.com/design/human-interface-guidelines/color) · [HIG — Branding](https://developer.apple.com/design/human-interface-guidelines/branding) · [Apple Design Resources (iOS 27 kits, NY.dmg, SF Symbols 8)](https://developer.apple.com/design/resources/) · [ConcentricRectangle / iOS 26 corner rule](https://livsycode.com/swiftui/concentricrectangle-and-corner-radius-consistency/) · [WWDC25 — Get to know the new design system](https://developer.apple.com/videos/play/wwdc2025/356/) · [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/) · [Expo Router Native Tabs](https://docs.expo.dev/router/advanced/native-tabs/) · [Expo captureRef](https://docs.expo.dev/versions/latest/sdk/captureRef/) · [react-native-view-shot](https://github.com/gre/react-native-view-shot) · [Expo SDK 57 changelog](https://expo.dev/changelog/sdk-57) · [Reanimated withSpring](https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring/) · [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Product Page Optimization](https://developer.apple.com/help/app-store-connect/create-product-page-optimization-tests/create-a-test/) · [Eye Magazine — fashion and type](https://eyemagazine.com/feature/article/through-thick-and-think-fashion-and-type) · [Creative Boom — 10 trends creatives are over in 2026](https://www.creativeboom.com/insight/10-trends-creatives-are-so-over-in-2026/) · [Baymard — category page density](https://baymard.com/learn/ecommerce-category-page) · [SSENSE-TECH homepage layout system](https://medium.com/ssense-tech/behind-the-ssense-app-homepage-building-a-dynamic-uicollectionview-layout-system-962fa7ddd9ec) · [Casey Winters on PMF & retention](https://www.caseyaccidental.com/p/caseys-guide-to-finding-product-market-fit) · [emilkowalski/skills](https://github.com/emilkowalski/skills)