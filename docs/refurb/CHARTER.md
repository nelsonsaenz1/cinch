# Refurbishment Charter — read this before touching anything

The founder's directive (2026-08-06): a comprehensive **design refurbishment and
interaction polish** pass. NOT a redesign, rebrand, or product overhaul. The
benchmark is Instagram-grade polish — responsiveness, motion, consistency,
perceived speed — while remaining unmistakably Cinch. "Do not optimize for
maximum visual change. Optimize for maximum improvement within the established
direction."

## The canon (constraints, not inspiration)

1. `docs/design/field-guide-content.md` — the ten-section Claude Design field
   guide. The Plate / lookbook identity. This is the source of truth.
2. `docs/design/cinch-app-design.html` — the founder-supplied design bundle.
3. `docs/design-directive.md` and `docs/design/field-guide-audit.md`.
4. The five approved ASC screenshots (`docs/app-store/screenshots/`) — the
   founder: "thats exactly how I want the site to look. Exactly like those
   pictures."
5. `src/theme/tokens.ts` — palette (locked), spring presets (transcribed from
   Apple — extend only with the same discipline), concentric-corner rule,
   44pt tap-target floor, GUTTER.

## Hard constraints

- **Palette is locked.** Canvas #FBFAF6, ink #1C1A16, accent #6E2B2B,
  accentWarm #B08A76, tray #F0ECE3 etc. Contrast problems are solved by
  changing usage (weight, background, placement), never by changing the hex.
- **Light-only app** (`userInterfaceStyle: 'light'`). Do not build dark mode.
- **Page inventory is locked**: 4 tabs (Today / Closet / Plan / Lately),
  stylist, capture→review, profile edit, events, settings. New *states*
  (empty/error/loading/permission) are welcome; new *pages* need a documented
  necessity, and a sheet/inline state is preferred.
- **Navigation structure is locked** (native tabs + the existing stacks).
- **Voice**: quiet, editorial, complete sentences, no exclamation marks, no
  growth-hack copy. Garment labels capitalize like the approved frames
  ("Mohair sweater · Penny loafers").
- **Motion discipline**: `spring.smooth` default, `snappy` for controls,
  `bouncy` exactly once in the app (plate landing). Respect Reduce Motion.
  Motion supports comprehension; no spectacle.
- **No new dependencies** without a written justification (license, maintenance,
  size). Prefer what's installed: Reanimated 4, Skia, expo-image, NativeWind.
- **TypeScript + lint must stay clean** (`npm run typecheck`, `npm run lint`).
- Match surrounding code style; comments only for non-obvious constraints.

## Do not touch (concurrent session territory / founder files)

- `src/components/social/social-terms-sheet.tsx`
- `src/features/auth/use-social-terms.ts`
- `supabase/migrations/2026080810*.sql`, `supabase/tests/08_ugc_moderation.sql`
- `docs/analytics.md`
- `src/features/event-outfits/mutations.ts`
- Untracked root files: `Cinch App Design .html`, `Design.pdf`,
  `Marketing Designs.pdf`, `Cinch-selection.png`, `docs/superwall/*`
- Never run a second Metro bundler. Never touch `ios/Pods` symlinks.
- No secrets in commits. No edge-function or DB changes in this program.

## Decision test for every proposed change

1. Does this improve the current design?
2. Does it preserve Cinch's identity?
3. Does it fit the locked palette and the field guide?
4. Does it make the app easier or more pleasurable to use?
5. Is it a refinement, not a redesign?

One "no" → reject and record the rejection with its reason.

## Output discipline

Audit agents: read-only except your single assigned report file under
`docs/refurb/audit/`. Findings must cite `file:line` and classify each as:
preserve exactly / minor polish / visually refine / improve interaction /
consolidate into component / fix inconsistency / fix friction / add missing
state / reject (with reason).
