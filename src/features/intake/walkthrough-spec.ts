/**
 * Redesign 24's measurements, as data.
 *
 * Pure `.ts`, no React and no `@/theme/tokens`, for the two reasons every spec
 * module in this codebase is: `scripts/run-tests.mjs` bundles with esbuild,
 * which cannot parse React Native's Flow source, and a number a test cannot
 * read is a number that drifts. Same split as `capture-spec.ts`,
 * `ten-spec.ts` and `button-spec.ts`.
 *
 * EVERY VALUE HERE IS TRANSCRIBED FROM THE APPROVED ARTIFACT'S OWN "Tokens &
 * measurements" line, not eyedropped from a PNG:
 *
 *   Headline Instrument Serif 38/1.1 · spoken examples Instrument Serif italic
 *   25–29/1.28 · elapsed timer Instrument Serif 58/1.05 · quoted utterance
 *   italic 17 in clay. Waveform 76pt tall, 4pt bars, 3pt gaps, alternating
 *   oxblood and clay. Cards 18pt radius, plate 212pt; primary 56pt at 14pt
 *   radius, secondary 52pt; 62pt at AX. Chips 12pt radius, 11/18pt padding.
 *
 * NO COLOUR LIVES HERE. The artifact's palette line — paper #FBFAF6, ink
 * #1C1A16, oxblood #6E2B2B, clay #B08A76, blush #F7EDE8, fill #F0ECE3, sand
 * #E4DED2, muted #6B665C — is the app's existing palette exactly, token for
 * token (`canvas`, `ink`, `accent`, `accentWarm`, `blush`, `tray`, `sand`,
 * `muted`). The design introduces no ninth colour, so this module names tones
 * by TOKEN KEY and the components resolve them through `useTheme()`. A hex
 * typed here would be a second palette wearing a spec's clothes.
 */

// ---------------------------------------------------------------------------
// Type
// ---------------------------------------------------------------------------

/**
 * The serif sizes this page sets by hand.
 *
 * These are `fontSize` overrides on the serif variants rather than new `Text`
 * variants, because they are one page's editorial scale rather than a role the
 * app repeats. The one place that is NOT true is the timer: 58 is far enough
 * off `display`'s 40 that it carries its own cap-trim, which is why the
 * component sets `trim` and this table records the leading it was computed at.
 */
export const TYPE = {
  /** The phase headline — "Open the wardrobe and talk." */
  headline: 38,
  headlineLeading: 1.1,
  /**
   * The spoken examples, promoted from footnote to specimen. A RANGE, not a
   * value: the artifact draws them at 25 in `invitation-default` and at 29 in
   * `spoken-examples-hero`, and the difference is Dynamic Type, not two
   * designs. The component sets the floor and lets the OS scale up — see
   * `largest-accessibility-text`, where they grow and the block scrolls.
   */
  exampleMin: 25,
  exampleMax: 29,
  exampleLeading: 1.28,
  /** The elapsed clock, the recording frame's hero. */
  timer: 58,
  timerLeading: 1.05,
  /** The quoted utterance on a procession card, set in clay. */
  utterance: 17,
} as const;

// ---------------------------------------------------------------------------
// The waveform
// ---------------------------------------------------------------------------

/**
 * V-02's seismograph, widened and warmed.
 *
 * WHAT CHANGED AND WHAT DID NOT. The strokes are wider (4 from 3), the gaps
 * tighter (3 from 4), the field taller (76 from 40), and the ink-at-35% single
 * tone is replaced by alternating oxblood and clay. The SAMPLING is untouched:
 * same ~11Hz tick, same 48-stroke history, same strip-chart translate. This is
 * a paint change to a mechanism that already reads amplitude honestly, and the
 * mechanism is the part that was argued.
 *
 * Still decorative by contract. The artifact is explicit — "the Recording label
 * and the timer carry the state for anyone who cannot see it" — which is why
 * `LevelMeter` stays `accessibilityElementsHidden`.
 */
export const WAVEFORM = {
  /** The field's height. A bar at full amplitude fills it. */
  height: 76,
  barWidth: 4,
  gap: 3,
  /** A bar never vanishes — a flat line reads as broken, not as quiet. */
  minHeight: 4,
  /** Unchanged from the shipped meter: ~4.3s of visible history. */
  count: 48,
} as const;

/** Bar pitch — width plus gap, the distance the strip travels per tick. */
export const WAVEFORM_PITCH = WAVEFORM.barWidth + WAVEFORM.gap;

/**
 * Which of the two warm tones a bar takes.
 *
 * Alternating, by index, so the pattern is a property of POSITION rather than
 * of the sample — a bar that changed colour with amplitude would be encoding
 * loudness in hue, which is exactly the inferred-content claim the whole
 * waveform contract refuses. Returns a theme key; the component resolves it.
 */
export function barTone(index: number): 'accent' | 'accentWarm' {
  return index % 2 === 0 ? 'accent' : 'accentWarm';
}

// ---------------------------------------------------------------------------
// Boxes
// ---------------------------------------------------------------------------

/** The procession card and every notice band on these pages. */
export const CARD = {
  radius: 18,
  /** The garment plate inside a procession card — a 212pt square well. */
  plate: 212,
  /** The band's inner padding, shared by the tray and blush notices. */
  padding: 16,
} as const;

/**
 * The controls.
 *
 * `minHeight`, never `height`, at every call site: the artifact's own
 * accessibility line is "≥44pt, ≥56pt at AX sizes" and "Dynamic Type is never
 * clamped", so a label that needs more than 56 must be allowed to take it.
 * `ax` is the floor the AX sizes raise to, not a second fixed box.
 */
export const CONTROL = {
  primaryHeight: 56,
  secondaryHeight: 52,
  radius: 14,
  ax: 62,
} as const;

/** The attribute and picker chips. */
export const CHIP = {
  radius: 12,
  paddingVertical: 11,
  paddingHorizontal: 18,
} as const;

// ---------------------------------------------------------------------------
// The recording frame's two words
// ---------------------------------------------------------------------------

/**
 * The state label in the recording frame's top-right — "RECORDING" / "PAUSED".
 *
 * A WORD, not a colour and not a dot. It is one half of the pair the artifact
 * names as authoritative for anyone who cannot see the waveform (the timer is
 * the other), which is why it is a real string on the page rather than a tint
 * on the bars.
 */
export function recordingStateLabel(paused: boolean): string {
  return paused ? 'Paused' : 'Recording';
}

/**
 * The supporting line under the waveform.
 *
 * Both halves are statements of FACT about the recorder as it already ships,
 * which is the only reason this page is allowed to print them. "Paused time is
 * not counted" is `use-recorder`'s own arithmetic said out loud — it
 * accumulates elapsed across pauses precisely so `startedAt` cannot count the
 * gap — and the resting line makes no claim about what has been heard, because
 * at this point nothing has been read and there is no transcript to claim from.
 */
export function recordingSupportLine(paused: boolean): string {
  return paused ? 'Paused time is not counted.' : 'Say one piece at a time. There is no rush.';
}
