/** @type {import('tailwindcss').Config} */

const { leading, tracking } = require('./src/theme/font-metrics');

// Cinch design tokens.
//
// Editorial-minimal with streetwear energy — SSENSE meets Apple Weather.
// Garment cutouts sit on warm paper, and exactly one accent carries every
// call to action.
//
// The accent is a deliberate ultramarine rather than the terracotta/amber that
// current models reach for by default on "editorial" briefs; that palette has
// become recognizable as generated and reads generic next to real fashion work.
// Ultramarine on warm paper is colder, sharper, and more technical.

module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: { DEFAULT: '#FAF9F6', dark: '#141310' },
        surface: { DEFAULT: '#FFFFFF', dark: '#1E1C18' },
        // Cutouts are photographed against this, so it must stay neutral-warm
        // and never tint the garment.
        tray: { DEFAULT: '#F2F0EA', dark: '#26241F' },

        // Type
        ink: { DEFAULT: '#141310', dark: '#FAF9F6' },
        muted: { DEFAULT: '#6B665C', dark: '#9C968A' },
        hairline: { DEFAULT: '#E3E0D8', dark: '#33302A' },
        // The lookbook's structural rules. `hairline` at 1.25:1 is a whisper —
        // right for a divider between list rows, too faint to carry the plate
        // grammar. `rule` is ink at 18%, so it composites correctly over both
        // canvas and tray without needing a second token.
        rule: { DEFAULT: 'rgba(20,19,16,0.18)', dark: 'rgba(250,249,246,0.20)' },

        // The one accent
        accent: { DEFAULT: '#1B3BFF', dark: '#5C74FF' },

        // Semantic — used sparingly; never as decoration
        positive: '#2E7D4F',
        warning: '#B4741F',
        critical: '#B3261E',
      },
      fontFamily: {
        // React Native does NOT synthesise weights for custom fonts: setting
        // fontWeight on a loaded family is silently ignored, and you get the
        // regular cut back. Every weight therefore has to be its own family
        // name, which is why these are named by weight rather than by role.
        //
        // Bodoni Moda — the didone is the fashion-magazine letterform. Used
        // large only; its hairlines break up below about 28px.
        //
        // Two optical masters, not one. `display` is cut at opsz=24 for the
        // wordmark and screen titles, where the caption master's fat hairlines
        // killed all the stroke contrast. `title` stays on the stock opsz=11
        // cut, because at 28px the finer hairline would fall under a device
        // pixel. See src/app/_layout.tsx for the measurements.
        display: ['BodoniModa_Display'],
        title: ['BodoniModa_600SemiBold'],
        // Archivo — condensed grotesque with true tabular figures, legible at
        // small sizes. Reads like a garment care label.
        body: ['Archivo_400Regular'],
        medium: ['Archivo_500Medium'],
        semibold: ['Archivo_600SemiBold'],
        mono: ['Archivo_500Medium'],
      },
      // Line heights are COMPUTED, never typed by hand. `leading()` takes the
      // ratio we want and clamps it up to the font's own line box, because
      // anything below that floor gets silently clipped at the top by CoreText.
      // See src/theme/font-metrics.js — the didone needs 1.525, the grotesque
      // only 1.088, so one "tight display leading" number cannot serve both.
      // scripts/typography-smoke.ts asserts every token clears its floor.
      //
      // Tracking follows Apple's published optical curves, not taste: Bodoni
      // uses the New York table (24 -> -0.26 ... 72 -> -1.09, interpolated),
      // the only Apple spec for a serif display face. Archivo uses the SF Pro
      // curve up to 20pt and holds at -0.40 above it — SF's positive tracking
      // at large sizes is specific to SF's design and reads like a template on
      // a narrower grotesque. RN letterSpacing is absolute points, never em.
      fontSize: {
        // ── Bodoni Moda. Display only — never below 24px (didone dazzle:
        //    the heavy stems dominate and the hairlines vanish).
        wordmark: [`64px`, { lineHeight: `${leading('bodoni', 64, 1.05)}px`, letterSpacing: '-0.95px' }],
        display: [`40px`, { lineHeight: `${leading('bodoni', 40, 1.05)}px`, letterSpacing: '-0.55px' }],
        title: [`28px`, { lineHeight: `${leading('bodoni', 28, 1.1)}px`, letterSpacing: '-0.33px' }],
        // The plate title — the didone at its smallest legal size.
        plate: [`24px`, { lineHeight: `${leading('bodoni', 24, 1.1)}px`, letterSpacing: '-0.26px' }],

        // ── Archivo
        // `figure` is title-sized but grotesque — big tabular numbers on
        // Profile and item detail, kept out of the didone's tall line box.
        figure: [`28px`, { lineHeight: `${leading('archivo', 28, 1.14)}px`, letterSpacing: '-0.4px' }],
        heading: [`20px`, { lineHeight: `${leading('archivo', 20, 1.25)}px`, letterSpacing: '-0.45px' }],
        // 17, not 16: Apple's iOS Body is 17pt, and every native control label
        // on screen sits at 17 — 16 reads a half-step small next to them.
        body: [`17px`, { lineHeight: `${leading('archivo', 17, 1.5)}px`, letterSpacing: '-0.43px' }],
        callout: [`16px`, { lineHeight: `${leading('archivo', 16, 1.5)}px`, letterSpacing: '-0.31px' }],
        label: [`13px`, { lineHeight: `${leading('archivo', 13, 1.38)}px`, letterSpacing: '-0.08px' }],
        caption: [`11px`, { lineHeight: `${leading('archivo', 11, 1.27)}px`, letterSpacing: '0.06px' }],
        // The tracked-out grotesque eyebrow — the fashion-magazine signature.
        eyebrow: [`11px`, { lineHeight: `${leading('archivo', 11, 1.27)}px`, letterSpacing: '1.1px' }],
        // The data line under a plate. Tabular figures, wide tracking.
        colophon: [`10px`, { lineHeight: '14px', letterSpacing: '0.9px' }],
      },
      // Concentric, per the HIG: inner = outer - inset, anchored at the plate
      // (a visible container), not the device bezel. `full` capsules belong to
      // the glass chrome layer only — content-layer controls are `md`;
      // SSENSE / Mytheresa / Vestiaire all use rectangles, and the pill is a
      // consumer-app signature.
      borderRadius: {
        xs: '2px',
        sm: '4px',
        DEFAULT: '8px', // plate inner: 20 - 12 padding
        md: '12px', // buttons, fields, chips
        lg: '16px',
        plate: '20px', // outfit plate, item card
        sheet: '38px', // half sheets, iOS 26 inset
        full: '9999px', // GLASS CHROME ONLY
        // Transitional aliases; retire as screens are rewritten.
        card: '20px',
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
