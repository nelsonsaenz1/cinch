/** @type {import('tailwindcss').Config} */

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
        // Editorial display for headers, set tight.
        display: ['Georgia', 'Times New Roman', 'serif'],
        body: ['System', 'ui-sans-serif', 'sans-serif'],
        // Tabular numerals for every stat (wear count, cost-per-wear).
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        display: ['40px', { lineHeight: '42px', letterSpacing: '-1.2px' }],
        title: ['28px', { lineHeight: '32px', letterSpacing: '-0.6px' }],
        heading: ['20px', { lineHeight: '25px', letterSpacing: '-0.3px' }],
        body: ['16px', { lineHeight: '24px' }],
        label: ['13px', { lineHeight: '17px', letterSpacing: '0.2px' }],
        caption: ['11px', { lineHeight: '14px', letterSpacing: '0.4px' }],
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
