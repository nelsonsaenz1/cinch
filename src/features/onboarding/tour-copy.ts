/**
 * The first-run tour's copy — atlas 36, states TR-01…TR-03.
 *
 * Three frames, and the count is a rule rather than a coincidence: "three
 * frames, hard limit. If a fourth idea needs explaining, it belongs in an
 * empty state." `tour-state.ts` asserts the limit; this file is only the
 * words.
 *
 * Pure `.ts`, no React, for the reason recorded in every other copy module
 * here: the test bundler cannot parse React Native's Flow source, so anything
 * a test needs to read has to be reachable without importing a component.
 */

import { PLANS } from '@/features/billing/plans';
import { numberWord } from '@/features/onboarding/reveal-copy';

/**
 * The ten in TR-02 — "Ten pieces is enough to start" — is the free closet,
 * `PLANS.free.items`, not a number typed into a sentence.
 *
 * It is deliberately NOT `MIN_CLOSET_FOR_OUTFITS` (8). That constant is the
 * engine's floor for producing *a* look; it is internal, it is never printed,
 * and no screen has ever called it "ten". The number the user meets is the
 * free tier's ten — The Ten's own masthead already asks for it ("Add ten
 * pieces from your closet"), and Today's empty state counts toward the same
 * closet. One number, one meaning, read from the one
 * place that defines it: change the tier and this sentence changes with it.
 */
export const TOUR_CLOSET_TARGET = PLANS.free.items;

export type TourFrameId = 'TR-01' | 'TR-02' | 'TR-03';

/** The illustration under the body — each frame draws a different thing. */
export type TourPlate = 'closet' | 'transformation' | 'morning';

export type TourFrame = {
  id: TourFrameId;
  /** "One · The promise" — the number spelled out, then the subject. */
  eyebrow: string;
  headline: string;
  body: string;
  /**
   * Ink on frame one only. "The tour walks from the announcement onto the
   * paper the app is printed on" — spend the dark ground once or it stops
   * meaning anything.
   */
  ground: 'canvas' | 'ink';
  plate: TourPlate;
  /** The one primary action, full width, at the foot. */
  action: string;
  /** Text, never a second button. Last frame only. */
  secondary: string | null;
  /** Skip is on every frame but the last, where the two real choices replace it. */
  skippable: boolean;
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const TOUR_FRAMES: readonly TourFrame[] = [
  {
    id: 'TR-01',
    eyebrow: 'One · The promise',
    headline: 'Your whole closet, on one page.',
    // "No shop" was true when written and stopped being true when the commerce
    // surfaces shipped. The replacement is the founder's own wording, and it
    // claims something Cinch can still keep: the closet leads, and a shop is
    // only ever offered against a gap the closet actually has. "No strangers,
    // no feed" survives unchanged — both are still true.
    body: 'Cinch keeps a record of what you own and what you wore. Your closet first. Shop only when something is genuinely missing. No strangers, no feed to keep up with.',
    ground: 'ink',
    plate: 'closet',
    action: 'Next',
    secondary: null,
    skippable: true,
  },
  {
    id: 'TR-02',
    eyebrow: 'Two · The camera',
    headline: 'Photograph it once.',
    body:
      'Lay a piece flat, take one picture, and Cinch cuts it out, names the colour and files it. ' +
      `${cap(numberWord(TOUR_CLOSET_TARGET))} pieces is enough to start; the rest can come slowly.`,
    ground: 'canvas',
    plate: 'transformation',
    action: 'Next',
    secondary: null,
    skippable: true,
  },
  {
    id: 'TR-03',
    eyebrow: 'Three · The ritual',
    headline: 'Then, every morning, one page.',
    body: 'Today opens on the weather, what you wore last, and a look built from what is clean and in the wardrobe. Confirm it, or change it, and get on with the day.',
    ground: 'canvas',
    plate: 'morning',
    action: 'Start with the camera',
    // Both ways out are real: begin capturing, or land on an app you have
    // already been told how to read.
    secondary: 'I’ll look around first',
    skippable: false,
  },
] as const;

/**
 * The sample weather on TR-03's miniature Today card.
 *
 * The atlas prints "Wednesday · 17° and grey", which is Celsius; the app is
 * Fahrenheit throughout, and the contract's rule about the atlas's sterling
 * prices is the same rule — never print a glyph the atlas chose, read the
 * app's own formatter. 17°C is what goes in; `formatTemp` decides what comes
 * out. The day and the sky stay the atlas's, because this is a picture of a
 * page and is announced to VoiceOver as one — the same settlement
 * `SamplePlate` already ships under.
 */
export const TOUR_SAMPLE_WEEKDAY = 'Wednesday';
export const TOUR_SAMPLE_FEELS_C = 17;
export const TOUR_SAMPLE_SKY = 'and grey';
