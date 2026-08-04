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
      // See src/theme/font-metrics.js — and note how far apart the two families
      // sit: the didone needs 1.525, the grotesque only 1.088, so a single
      // "tight display leading" number cannot serve both.
      //
      // scripts/typography-smoke.ts asserts every one of these clears its floor.
      // Tracking is computed too, at -0.015em for display sizes — Apple's own
      // tracking for New York at 72pt. Absolute px tracking does not survive a
      // change of size; see tracking() in font-metrics.js.
      fontSize: {
        // Bodoni Moda
        wordmark: [`62px`, { lineHeight: `${leading('bodoni', 62, 1.06)}px`, letterSpacing: `${tracking(62, -0.015)}px` }],
        display: [`40px`, { lineHeight: `${leading('bodoni', 40, 1.05)}px`, letterSpacing: `${tracking(40, -0.015)}px` }],
        title: [`28px`, { lineHeight: `${leading('bodoni', 28, 1.14)}px`, letterSpacing: `${tracking(28, -0.015)}px` }],

        // Archivo
        // `figure` is title-sized but grotesque — the big tabular numbers on
        // Profile and the item detail screen. It exists so those numbers do not
        // inherit the didone's very tall line box and blow the rhythm apart.
        figure: [`28px`, { lineHeight: `${leading('archivo', 28, 1.14)}px`, letterSpacing: `${tracking(28, -0.02)}px` }],
        heading: [`20px`, { lineHeight: `${leading('archivo', 20, 1.25)}px`, letterSpacing: `${tracking(20, -0.015)}px` }],
        body: [`16px`, { lineHeight: `${leading('archivo', 16, 1.5)}px` }],
        label: [`13px`, { lineHeight: `${leading('archivo', 13, 1.31)}px`, letterSpacing: `${tracking(13, 0.015)}px` }],
        caption: [`11px`, { lineHeight: `${leading('archivo', 11, 1.27)}px`, letterSpacing: `${tracking(11, 0.04)}px` }],
      },
      borderRadius: {
        card: '18px',
        chip: '999px',
        sheet: '28px',
      },
      spacing: {
        gutter: '20px',
        // Minimum tap target. Accessibility requirement, not a suggestion.
        tap: '44px',
      },
    },
  },
  plugins: [],
};
