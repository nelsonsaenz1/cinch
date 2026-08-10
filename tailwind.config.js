/** @type {import('tailwindcss').Config} */

const { leading, tracking } = require('./src/theme/font-metrics');

// Cinch design tokens.
//
// A print lookbook that regenerates every morning — considered, quiet, warm.
// Garment cutouts sit on warm paper, and exactly one accent carries every
// call to action.
//
// The accent is oxblood — a deep, worn burgundy that reads as ink-with-blood
// rather than a UI colour. On warm paper it's editorial and confident without
// the coldness of a technical blue; it's SPENT, never sprayed: one oxblood
// action per screen.
//
// The app is LIGHT ONLY (userInterfaceStyle 'light' in app.config.ts). Every
// token still carries a `dark` value so no `dark:` class throws, but each is
// set equal to its light value — the app never renders a second appearance.

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces — warm paper, warm ink. Canvas is the page; surface is a
        // card lifted off it; tray is the recessed well a garment sits in.
        canvas: { DEFAULT: '#FBFAF6', dark: '#FBFAF6' },
        surface: { DEFAULT: '#FFFFFF', dark: '#FFFFFF' },
        tray: { DEFAULT: '#F0ECE3', dark: '#F0ECE3' },
        // The deepest sand, for a tile that needs to sit BACK from the tray
        // without becoming a border (progress tracks, selected fills).
        sand: { DEFAULT: '#EAE5DB', dark: '#EAE5DB' },

        // Type. Ink is a warm near-black (not a true black): on warm paper a
        // neutral black reads cold and hard, and this brown-black keeps the
        // page soft while still clearing well past 15:1 on canvas. `muted` is
        // body-secondary — and, since the 2026-08-06 contrast pass, the tone
        // eyebrows and colophons are set in. `faint` fails AA as text on
        // canvas (3.5:1): reserve it for decorative marks and dark grounds.
        ink: { DEFAULT: '#1C1A16', dark: '#1C1A16' },
        muted: { DEFAULT: '#6B665C', dark: '#6B665C' },
        faint: { DEFAULT: '#8A8578', dark: '#8A8578' },
        // One step lighter than `faint` — the Lately ledger's attribution
        // voice: whose piece a row is, the elapsed mark beside it, the chevron
        // that points away. Credit lines, never body copy; the same AA caveat
        // as `faint` applies, harder.
        byline: { DEFAULT: '#A29C90', dark: '#A29C90' },
        // Lighter again than `byline` — the Plan atlas's example-content
        // voice: the ghost weekday, the ghost trip label, the placeholder
        // date on an example card. Content that is explicitly NOT the user's
        // data, so it must read as furniture even at a glance; never used for
        // anything real, so the AA caveat is moot by construction.
        ghost: { DEFAULT: '#C7C1B4', dark: '#C7C1B4' },
        // Divider between list rows — a whisper. `rule` is a touch stronger,
        // for the card borders and section rules that carry the plate grammar.
        // Both are warm ink at low alpha so they composite over canvas and tray.
        hairline: { DEFAULT: 'rgba(28,26,22,0.09)', dark: 'rgba(28,26,22,0.09)' },
        rule: { DEFAULT: 'rgba(28,26,22,0.12)', dark: 'rgba(28,26,22,0.12)' },
        // The answered-field border, and nothing else. The New Occasion atlas
        // states the rule in prose — "Answered fields darken their border
        // rather than growing a checkmark" — so a field's own progress is
        // carried entirely by this ramp: `rule` while empty, `rule-strong`
        // once there is something in it, solid `ink` at 1.5px under the
        // cursor. It is a designed state, which is why it earns a token
        // instead of a literal alpha. Not a divider: a row rule drawn this
        // hard stops reading as a rule and starts reading as a box.
        'rule-strong': { DEFAULT: 'rgba(28,26,22,0.28)', dark: 'rgba(28,26,22,0.28)' },

        // The accent — oxblood. One primary action per screen.
        accent: {
          DEFAULT: '#6E2B2B',
          hover: '#8A3A35',
          light: '#F1E7E4',
          dark: '#6E2B2B',
        },
        // The second accent. Warm clay, for the places where oxblood would read
        // as an error or a link — data highlights, the warm half of a chart.
        'accent-warm': { DEFAULT: '#B08A76', hover: '#9C7460', dark: '#B08A76' },
        // The warm rose surface — accentWarm composited over tray. It marks the
        // one card on a page that belongs to the reader ("Your look" on an
        // event). `blush-rule` is its hairline; a plain `rule` over blush goes
        // grey and kills the warmth. Spend it like the accent: one per screen.
        blush: { DEFAULT: '#F7EDE8', dark: '#F7EDE8' },
        'blush-rule': { DEFAULT: 'rgba(176,138,118,0.45)', dark: 'rgba(176,138,118,0.45)' },
        // The one dimming value — sheet backdrops and gradients over garment
        // photography. Warm ink at 40%, never a neutral black.
        scrim: { DEFAULT: 'rgba(28,26,22,0.40)', dark: 'rgba(28,26,22,0.40)' },

        // Semantic — used sparingly; never as decoration. Warmed to sit on
        // paper; oxblood already owns "attention", so critical is a distinct,
        // deeper brick to avoid reading as the accent.
        positive: '#1A8754',
        warning: '#C58A2E',
        critical: '#8A2E28',
      },
      fontFamily: {
        // The system is one serif and one grotesque.
        //
        // Instrument Serif carries every display role — wordmark, titles, the
        // big data figures. It is a single weight and a single optical master,
        // so `display` and `title` are the same family; the names are kept only
        // so existing `font-title` classes keep resolving. `displayItalic` is a
        // real italic cut (RN will not synthesise a slant on a loaded family),
        // used for the emphasis words like "already own."
        display: ['InstrumentSerif_400Regular'],
        title: ['InstrumentSerif_400Regular'],
        displayItalic: ['InstrumentSerif_400Regular_Italic'],
        // Helvetica Neue — the iOS system grotesque, referenced by its face
        // names. It is a SYSTEM font, so unlike a bundled custom family it does
        // honour distinct cuts by PostScript name; there is no true 600, so the
        // heavier roles map to Medium, which is the right weight for the tracked
        // labels and buttons without going blunt.
        body: ['HelveticaNeue'],
        medium: ['HelveticaNeue-Medium'],
        semibold: ['HelveticaNeue-Medium'],
        mono: ['HelveticaNeue'],
      },
      // Line heights are COMPUTED, never typed by hand. `leading()` takes the
      // ratio we want and clamps it up to the font's own line box, because
      // anything below that floor gets silently clipped at the top by CoreText.
      // See src/theme/font-metrics.js — Instrument Serif's box is 1.30, so the
      // tight display ratios below clamp up to it and the editorial measure
      // comes from `trim` (capTrim), not from a sub-floor lineHeight. Helvetica
      // sits at ~1.20, well under the body ratios, so grotesque text never
      // clamps. scripts/typography-smoke.ts asserts every token clears its floor.
      //
      // Tracking is light, not aggressive: Instrument Serif is a low-contrast
      // serif that wants close to its natural fit (the design tracks the big
      // wordmark only, at ~-0.01em), and Helvetica Neue needs none of the
      // negative kern SF Pro asked for. Uppercase eyebrows keep positive
      // tracking — the one place letters should breathe. RN letterSpacing is
      // absolute points, never em.
      fontSize: {
        // ── Instrument Serif (display + big data figures) ──────────────────
        wordmark: [`64px`, { lineHeight: `${leading('instrument', 64, 1.05)}px`, letterSpacing: '-0.6px' }],
        // The first-run tour's headline, and NOTHING else.
        //
        // Atlas 36 is unusually precise and says why: "Instrument Serif, 56px,
        // line-height 1.04, two or three words a line. It is the largest type
        // anywhere in the app." That last clause is the whole point of the
        // tour — three spreads visibly bigger than everything that follows —
        // and it stays true only for as long as nothing else reaches for this
        // step. Same rationing rule the ink ground lives under: the moment a
        // second screen uses it, it stops meaning anything.
        //
        // 1.04 rather than `display`'s 1.05 because the atlas asks for it and
        // `leading()` clamps up to the face's floor anyway, so the tighter
        // ratio cannot clip a glyph.
        spread: [`56px`, { lineHeight: `${leading('instrument', 56, 1.04)}px`, letterSpacing: '-0.5px' }],
        display: [`40px`, { lineHeight: `${leading('instrument', 40, 1.05)}px`, letterSpacing: '-0.3px' }],
        title: [`28px`, { lineHeight: `${leading('instrument', 28, 1.08)}px`, letterSpacing: '-0.15px' }],
        // The plate title — the serif at a compact size.
        plate: [`24px`, { lineHeight: `${leading('instrument', 24, 1.08)}px`, letterSpacing: '-0.1px' }],
        // `figure` is the big data number — serif now, matching the design's
        // stat grids (item detail "42×", closet strip "61×"). Tabular is a
        // no-op on this face; single hero values don't jitter regardless.
        figure: [`28px`, { lineHeight: `${leading('instrument', 28, 1.05)}px`, letterSpacing: '-0.15px' }],

        // ── Helvetica Neue (everything set small) ──────────────────────────
        heading: [`20px`, { lineHeight: `${leading('helvetica', 20, 1.25)}px`, letterSpacing: '-0.2px' }],
        // 17, not 16: Apple's iOS Body is 17pt, and every native control label
        // on screen sits at 17 — 16 reads a half-step small next to them.
        body: [`17px`, { lineHeight: `${leading('helvetica', 17, 1.5)}px`, letterSpacing: '0px' }],
        callout: [`16px`, { lineHeight: `${leading('helvetica', 16, 1.5)}px`, letterSpacing: '0px' }],
        label: [`13px`, { lineHeight: `${leading('helvetica', 13, 1.4)}px`, letterSpacing: '0px' }],
        caption: [`11px`, { lineHeight: `${leading('helvetica', 11, 1.3)}px`, letterSpacing: '0.1px' }],
        // The tracked-out grotesque eyebrow — the fashion-magazine signature.
        eyebrow: [`11px`, { lineHeight: `${leading('helvetica', 11, 1.3)}px`, letterSpacing: '1.6px' }],
        // The data line under a plate. Small caps, wide tracking.
        colophon: [`10px`, { lineHeight: '14px', letterSpacing: '1.4px' }],
      },
      // Concentric, per the HIG: inner = outer - inset, anchored at the plate
      // (a visible container), not the device bezel.
      //
      // ── `full`: the rule, settled ────────────────────────────────────────
      // The old note read "GLASS CHROME ONLY", which the app then contradicted
      // in a dozen honest places — every avatar monogram is a circle, so is the
      // circular back button on eight screens, so are the palette dots. Read
      // literally the rule outlawed the design's own signatures; read loosely
      // it outlawed nothing. The distinction it was always reaching for is not
      // *which layer* but *what shape*:
      //
      //   ALLOWED   `full` on a 1:1 box — a circle. Avatars, monograms, icon-
      //             only discs, dots, the glass chrome layer.
      //   FORBIDDEN `full` on a wider-than-tall box — a capsule. Any control
      //             carrying a text label is `md` (12px), full stop.
      //
      // A circle is a portrait frame; a capsule is a consumer-app signature.
      // SSENSE / Mytheresa / Vestiaire all set their labelled controls as
      // rectangles, and that is the stronger position. So: the segmented
      // toggle on Plan, the RSVP pills on an event, the New-event bar — all
      // capsules, all wrong, all `md`. The back button stays a circle.
      borderRadius: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px', // plate inner: 20 - 12 padding
        md: '12px', // buttons, fields, chips
        lg: '16px',
        plate: '20px', // outfit plate, item card
        sheet: '38px', // half sheets, iOS 26 inset
        full: '9999px', // CIRCLES AND GLASS CHROME ONLY — never a labelled capsule
        // Transitional alias; retire as screens are rewritten. (`card` retired
        // 2026-08-06 — zero call sites; use `plate`.)
        chip: '12px',
      },
      spacing: {
        hair: '1px',
        gutter: '20px', // page margin — the measure
        rhythm: '8px', // vertical baseline unit
        section: '28px', // between plates
        // HIG Accessibility, verbatim: "about 12 points of padding around
        // elements that include a bezel. For elements without a bezel, about
        // 24 points."
        bezel: '12px',
        bare: '24px',
        // Minimum tap target. Accessibility requirement, not a suggestion.
        tap: '44px',
      },
    },
  },
  plugins: [],
};
