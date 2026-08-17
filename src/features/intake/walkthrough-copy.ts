/**
 * The Walkthrough's copy — V-01, V-04, V-05 and the five V-13 branches.
 *
 * Pure `.ts`, no React, for the reason every copy module in this codebase is:
 * `scripts/run-tests.mjs` bundles with esbuild, which cannot parse React
 * Native's Flow source, so anything a test needs to read has to be reachable
 * without importing a component.
 *
 * EVERY NUMBER IN HERE IS PASSED IN. Nothing calls a clock, nothing rounds a
 * figure it was not given, and nothing prints a duration or a count it cannot
 * source — an unknown figure is omitted with the reason, never estimated and
 * never drawn as a dash.
 */

import { numberWord } from '@/features/onboarding/reveal-copy';

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// V-01 · the invitation
// ---------------------------------------------------------------------------

export const WALKTHROUGH_INVITATION = {
  eyebrow: 'Describe your closet',
  headline: 'Open the wardrobe and talk.',
  /**
   * ONE SENTENCE. The second half — "Cinch writes the list and you go through
   * it afterwards, one card at a time" — was said again, verbatim in substance,
   * by `HEARD.body` on the very next screen, where it is actually actionable.
   * The examples below are the body of this frame now.
   */
  body: 'Say what you see, in whatever words you use for it.',
  /**
   * Deliberately imperfect phrasing, set as italic prose rather than as chips.
   * They are teaching that the parser tolerates how people actually speak, and
   * a chip reads as a controlled vocabulary — the opposite lesson.
   *
   * Promoted from footnote to specimen: a ruled block at reading size, which is
   * what the frame is teaching, rather than three leftovers under a paragraph.
   */
  examples: ['“white linen shirt”', '“those brown loafers”', '“a heavy grey coat”'],
  /**
   * The consent clause, above the button, naming what happens to the audio.
   *
   * It used to add "You will be asked to allow that before the microphone
   * opens", which narrated the system prompt that arrives on its own a moment
   * later — the prompt is the actual request, and describing it in advance is
   * the app reading the OS aloud.
   */
  // One sentence, but the WHOLE sentence: the audio leaves the device for a
  // transcription service before Cinch's model reads the list, and this line
  // is the only place on the screen that names the third party in that path.
  // The trimmed clause was the one narrating the system prompt, never this.
  consent: 'The recording goes to the service that turns speech into text, then to the model that reads the list.',
  action: 'Start recording',
  /** The other door, one tap away at every point in the voice path. */
  secondary: 'Photograph them instead',
} as const;

// ---------------------------------------------------------------------------
// V-04 · reading it back
// ---------------------------------------------------------------------------

/**
 * "Four minutes of wardrobe, being written down."
 *
 * `durationMs` is the recorder's own measurement of the take. A take shorter
 * than a minute rounds UP to one rather than printing "zero minutes of
 * wardrobe", and a null duration — which the recorder can return when a stop
 * arrives from a backgrounding — drops the figure entirely rather than guessing
 * at it.
 */
export function readingBackHeadline(durationMs: number | null): string {
  if (durationMs == null || !Number.isFinite(durationMs)) {
    return 'Your wardrobe, being written down.';
  }
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `${cap(numberWord(minutes))} minute${minutes === 1 ? '' : 's'} of wardrobe, being written down.`;
}

export const READING_BACK = {
  eyebrow: 'Reading it back',
  body: 'This takes about half a minute. You can leave the app — the recording is saved and the list will be waiting.',
  slowTitle: 'Still working',
  slowBody:
    'Longer than usual. Nothing is lost if you close Cinch — the walkthrough resumes where it is.',
  slowAction: 'Leave it running',
} as const;

/**
 * When the slow notice appears.
 *
 * Additive, under the same layout, rather than a screen of its own: a slow
 * response must never look like a different failure. No percentage and no
 * spinner — the estimate is in prose and the notice is the only thing that
 * changes.
 */
export const SLOW_NOTICE_AFTER_MS = 12_000;

// ---------------------------------------------------------------------------
// V-05 · heard
// ---------------------------------------------------------------------------

export const HEARD = {
  eyebrow: 'Heard',
  body: 'Some of these will be wrong. Go through them one at a time — keep, fix or drop each card. Nothing enters your closet until you have been through the list.',
  action: 'Go through the list',
  unmatchedBody:
    'They are kept with the recording and shown at the end of the list, so you can decide what they were.',
} as const;

/** "23 pieces, in your own words." */
export function heardHeadline(pieces: number): string {
  return `${pieces} piece${pieces === 1 ? '' : 's'}, in your own words.`;
}

/**
 * "Six phrases Cinch could not place" — named as KEPT, never discarded.
 *
 * The count is spelled where the word exists, which is the same register the
 * rest of the hallway prints small counts in. Null at zero: zero is quiet, and
 * a heading announcing that nothing went wrong is noise.
 */
export function unmatchedTitle(count: number): string | null {
  if (count <= 0) return null;
  if (count === 1) return 'One phrase Cinch could not place';
  return `${cap(numberWord(count))} phrases Cinch could not place`;
}

/**
 * The composition chips — counts of what was HEARD, not of what will be kept.
 *
 * Present kinds only; a kind nobody mentioned is omitted rather than printed as
 * a zero. The sentence above the chips says what they are before the numbers
 * are read, which is the whole reason they are allowed to be bare figures.
 */
const HEARD_KIND_ORDER = [
  'tops',
  'bottoms',
  'dresses',
  'shoes',
  'outerwear',
  'bag',
  'headwear',
  'accessory',
] as const;

const HEARD_KIND_NOUN: Record<string, [string, string]> = {
  tops: ['top', 'tops'],
  bottoms: ['bottom', 'bottoms'],
  dresses: ['dress', 'dresses'],
  shoes: ['pair of shoes', 'shoes'],
  outerwear: ['coat', 'coats'],
  bag: ['bag', 'bags'],
  headwear: ['hat', 'hats'],
  accessory: ['accessory', 'accessories'],
};

export function heardChips(counts: Readonly<Record<string, number>>): string[] {
  const chips: string[] = [];
  for (const kind of HEARD_KIND_ORDER) {
    const n = counts[kind] ?? 0;
    if (n <= 0) continue;
    const noun = HEARD_KIND_NOUN[kind]!;
    chips.push(`${n} ${n === 1 ? noun[0] : noun[1]}`);
  }
  return chips;
}

// ---------------------------------------------------------------------------
// V-13 · five named causes
// ---------------------------------------------------------------------------

export type WalkthroughFailureCause =
  | 'denied'
  | 'silent'
  | 'unparsed'
  | 'offline'
  | 'signed_out';

export type FailureCopy = {
  headline: string;
  body: string;
  /** The filled action, and the one the reader is meant to take. */
  primary: string;
  /** Named exits under it, in the atlas's order. */
  secondaries: string[];
};

/**
 * A failure is a phase with its own screen and its own action, never a generic
 * error card with swapped copy.
 *
 * The first sentence states the fact; the second states the consequence and
 * names the exits. `offline` is the ONLY branch whose action is "Try again",
 * because it is the only one where the same audio can succeed — a silent or
 * oversized take would fail the same way, so its action says "Record again" and
 * naming why is what stops the second attempt being made against the same file.
 *
 * `durationMs` is used by the offline branch alone, and only to say how long
 * the recording that is safely on the phone runs. Unknown drops the figure.
 */
export function failureCopy(
  cause: WalkthroughFailureCause,
  durationMs: number | null = null,
): FailureCopy {
  switch (cause) {
    case 'denied':
      return {
        headline: 'The microphone is switched off for Cinch.',
        // "Nothing was recorded" is here because a denied prompt after a Start
        // tap otherwise reads as a lost take.
        body: 'Nothing was recorded. You can turn the microphone on in Settings, or photograph your ten instead — both end in the same closet.',
        primary: 'Photograph them instead',
        secondaries: ['Open Settings'],
      };
    case 'silent':
      return {
        headline: 'Cinch could not hear anything in that take.',
        body: 'The recording came through silent, so there is nothing to read back. This one needs a new take rather than another try — the same audio would fail the same way.',
        primary: 'Record again',
        secondaries: ['Photograph them instead'],
      };
    case 'unparsed':
      return {
        headline: 'Cinch heard you, but could not find any clothes in it.',
        body: 'Here is what it wrote down. Nothing has been added to your closet.',
        primary: 'Record again',
        // The atlas draws a third exit, "Type the list instead". It is stopped
        // — see the lane report: no typed-list intake exists, and building one
        // would be a fifth Add Clothes door, which the brief refuses outright.
        secondaries: ['Photograph them instead'],
      };
    case 'offline':
      return {
        headline: 'Cinch could not reach the service that reads your list.',
        body: `${savedRecordingClause(durationMs)} Try again when you have a signal, and it will pick up from the same audio — you do not have to say it twice.`,
        primary: 'Try again',
        // This is what puts the unfinished-walkthrough card on TR-06 — the two
        // frames are the two ends of one promise.
        secondaries: ['Leave it for later'],
      };
    case 'signed_out':
      return {
        headline: 'Cinch signed you out while you were talking.',
        body: 'A closet needs an account to go into, so the recording could not be started. Sign back in and the walkthrough opens where it was.',
        primary: 'Sign back in',
        secondaries: [],
      };
  }
}

/** "Your four-minute recording is saved on this phone." */
function savedRecordingClause(durationMs: number | null): string {
  if (durationMs == null || !Number.isFinite(durationMs)) {
    return 'Your recording is saved on this phone.';
  }
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return `Your ${numberWord(minutes)}-minute recording is saved on this phone.`;
}

// ---------------------------------------------------------------------------
// M-07 · the ceiling
// ---------------------------------------------------------------------------

export type CeilingCopy = {
  eyebrow: string;
  headline: string;
  body: string;
  primary: string;
  secondary: string;
  footer: string;
};

/**
 * M-07 — more heard than the free closet holds.
 *
 * A CAPACITY FACT, NOT AN UPSELL. No tier is named, no price appears and no
 * upgrade action is drawn; the paywall comes after the Reveal, where the reader
 * has seen what the closet makes. Every figure is passed in from
 * `PLANS.free.items` and `PLANS.free.storedItems`, so if the tier moves the
 * sentence moves with it.
 */
export function ceilingCopy(heard: number, active: number, stored: number): CeilingCopy {
  const held = Math.max(heard - active, 0);
  return {
    eyebrow: `${cap(numberWord(heard))} heard`,
    headline: `Your closet holds ${numberWord(active)} active at a time.`,
    body:
      `All ${numberWord(heard)} are saved. ${cap(numberWord(active))} stay active for Cinch to ` +
      `style from; the other ${numberWord(held)} wait in storage and you can swap any of them ` +
      'in whenever you like.',
    primary: `Choose which ${numberWord(active)} stay active`,
    secondary: 'Let Cinch choose for now',
    footer: 'Either way, nothing you said is deleted.',
  };
}

/** The ruled band's three rows, values right-aligned. */
export function ceilingRows(
  heard: number,
  active: number,
  storageCapacity: number,
): { label: string; value: string; quiet: boolean }[] {
  return [
    { label: 'Active now', value: String(active), quiet: false },
    { label: 'In storage', value: String(Math.max(heard - active, 0)), quiet: false },
    // The capacity itself is context rather than a figure about this closet,
    // so it is the quiet row.
    { label: 'Storage holds', value: String(storageCapacity), quiet: true },
  ];
}
