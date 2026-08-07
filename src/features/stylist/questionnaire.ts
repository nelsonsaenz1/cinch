import type { Garment, WeatherContext } from '@/lib/styling';

/**
 * The guided opening — a short questionnaire the stylist runs itself.
 *
 * A blank text box is the worst thing a stylist can open with. The person who
 * most needs styling help is exactly the person who cannot phrase the request,
 * and asking them to type it is asking them to do the job they came here to
 * hand over. So the stylist asks instead, three or four times, one tap each.
 *
 * EVERY STEP HERE IS SCRIPTED AND RUNS ON DEVICE. No model call per tap: the
 * questions are fixed, the answers are a closed set, and the whole flow is
 * instant, free and identical every time. Only the composed brief at the end
 * costs anything. That is also what lets the questions be honest — the stylist
 * never asks something it already knows (no dresses in the closet, no
 * silhouette question; weather already fetched, it says the temperature rather
 * than asking for it).
 *
 * Answers are keys, not prose. They compose into two things: a sentence for the
 * on-device intent parser and the beam search, and a small structured brief for
 * the model. Free text never enters either.
 */

// ---------------------------------------------------------------------------
// The closed vocabularies
// ---------------------------------------------------------------------------

/**
 * How the conversation was started. Kept as an enum because it is the one
 * questionnaire fact worth measuring, and an enum is the only shape that can
 * safely reach analytics.
 */
export type EntryKey = 'dressed' | 'event' | 'surprise' | 'browse';

export type StepKey = 'occasion' | 'silhouette' | 'mood' | 'weather';

/**
 * The mood palette.
 *
 * Two-word pairs, not form labels. "Formality: 4" is a database column;
 * "dark and romantic" is a feeling someone recognises before they finish
 * reading it, which is the whole point of a tappable answer. They deliberately
 * describe a register rather than a colour — the engine already knows the
 * colours, and a mood the person picks for themselves is a better instruction
 * than one inferred from a hex value.
 */
export const MOODS = [
  { key: 'bright', label: 'Bright and fun', phrase: 'bright, a little playful' },
  { key: 'dark', label: 'Dark and romantic', phrase: 'dark and romantic' },
  { key: 'quiet', label: 'Clean and quiet', phrase: 'clean and quiet' },
  { key: 'soft', label: 'Soft and easy', phrase: 'soft and easy' },
  { key: 'sharp', label: 'Sharp and tailored', phrase: 'sharp and tailored' },
] as const;

export type MoodKey = (typeof MOODS)[number]['key'];

/**
 * Occasions, each carrying the numbers the beam search actually ranks on.
 *
 * The formality and occasion travel with the option rather than being
 * recovered from the composed sentence by `parseIntent`. Round-tripping a fact
 * we already hold through a regex is how a tapped answer ends up scored
 * differently from the same answer typed — and the tapped one is the one we
 * promised was deterministic.
 */
export const OCCASIONS = [
  { key: 'work', label: 'Work', phrase: 'I’m in the office today.', formality: 3, occasion: 'office' },
  { key: 'dinner', label: 'Dinner out', phrase: 'I’m going out for dinner.', formality: 4, occasion: 'date' },
  { key: 'drinks', label: 'Drinks', phrase: 'I’m going for drinks later.', formality: 2, occasion: 'casual' },
  { key: 'day', label: 'A normal day', phrase: 'Nothing in particular today.', formality: 2, occasion: 'casual' },
] as const;

/** The same question when the person has already said it is an event. */
export const EVENT_OCCASIONS = [
  { key: 'wedding', label: 'A wedding', phrase: 'I have a wedding.', formality: 5, occasion: 'formal' },
  { key: 'party', label: 'A party', phrase: 'I have a party.', formality: 3, occasion: 'event' },
  { key: 'work_event', label: 'Something for work', phrase: 'I have a work event.', formality: 4, occasion: 'office' },
  { key: 'dinner_event', label: 'A dinner', phrase: 'I have a dinner.', formality: 4, occasion: 'date' },
  { key: 'formal', label: 'Black tie', phrase: 'It’s black tie.', formality: 5, occasion: 'formal' },
] as const;

type OccasionOption = (typeof OCCASIONS)[number] | (typeof EVENT_OCCASIONS)[number];

/**
 * Dress or separates — the question the owner hears people ask themselves
 * first, before anything about colour or occasion.
 *
 * `requiresDress` is why the step is worth scripting rather than always
 * showing: offering "a dress" to a closet with no dresses is the exact
 * hollow-question tell that makes a chat feel like a form.
 */
export const SILHOUETTES = [
  { key: 'dress', label: 'A dress', phrase: 'a dress', requiresDress: true },
  { key: 'separates', label: 'Trousers', phrase: 'trousers', requiresDress: false },
  { key: 'either', label: 'Either’s fine', phrase: '', requiresDress: false },
] as const;

export type SilhouetteKey = (typeof SILHOUETTES)[number]['key'];

/** The weather step. Only ever asked when there is a forecast to name. */
export const WEATHER_ANSWERS = [
  { key: 'outside', label: 'Dress for it' },
  { key: 'inside', label: 'I’m mostly inside' },
] as const;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

export type QuestionOption = { key: string; label: string };

export type Step = {
  key: StepKey;
  /** What the stylist says, in its own voice. Rendered as a stylist bubble. */
  question: string;
  options: QuestionOption[];
};

export type Answers = Partial<Record<StepKey, string>>;

/**
 * A brief, as it goes to the server.
 *
 * Enum keys only. This is the whole reason the questionnaire is worth having
 * on the wire at all: "mood: dark" is four characters the model can act on,
 * where the same instruction inferred from prose is a guess.
 */
export type StylistBrief = {
  occasion: string;
  silhouette?: SilhouetteKey;
  mood?: MoodKey;
  /** Null when there was no forecast to ask about. */
  dressForWeather?: boolean;
};

/**
 * What the questionnaire knows before it asks anything.
 *
 * The forecast and its formatted temperature are one fact, so they are paired
 * in the type rather than left as two independently nullable fields. The weather
 * step names the number out loud, and the caller's string is the only place the
 * display unit is decided — the stylist screen formats in Fahrenheit. A shape
 * that permitted a forecast with no reading would make that step reachable with
 * nothing to name, and the only way out would be re-deriving the temperature
 * here from the raw Celsius the context carries, which is how a Fahrenheit
 * screen ends up printing a Celsius number. Pairing them deletes that branch
 * rather than guarding it.
 */
export type QuestionnaireContext = {
  wardrobe: Garment[];
} & (
  | {
      weather: WeatherContext;
      /** Degrees, already formatted for display — e.g. "46°". */
      temperature: string;
    }
  | { weather: null; temperature: null }
);

const hasDresses = (wardrobe: Garment[]) => wardrobe.some((g) => g.slot === 'dress');

/**
 * A short, plain reading of the forecast for the weather step.
 *
 * Names the number rather than asking for it. Someone who has already told the
 * app where they are should never be asked what the weather is like.
 *
 * The already-formatted temperature is required rather than optional because
 * `QuestionnaireContext` ships it alongside the forecast: there is no state in
 * which this has a forecast to read and no number to name, so there is nothing
 * for a fallback to do except get the unit wrong.
 */
function weatherLine(weather: WeatherContext, temperature: string): string {
  if (weather.precipitationChance >= 0.4) {
    return `It is ${temperature} out with rain likely.`;
  }
  if (weather.swing) {
    return `It is ${temperature} now, but the day swings a long way.`;
  }
  return `It is ${temperature} out.`;
}

/**
 * Build the script for one run.
 *
 * Steps are computed up front rather than decided as the person taps, so the
 * progress indicator can be honest about how many questions are left — the
 * single strongest reason people finish a multi-step flow instead of abandoning
 * it partway.
 */
export function buildSteps(entry: EntryKey, ctx: QuestionnaireContext): Step[] {
  if (entry === 'surprise' || entry === 'browse') return [];

  const steps: Step[] = [];

  const occasions: readonly OccasionOption[] = entry === 'event' ? EVENT_OCCASIONS : OCCASIONS;
  steps.push({
    key: 'occasion',
    question: entry === 'event' ? 'What kind of thing is it?' : 'What is the day asking for?',
    options: occasions.map((o) => ({ key: o.key, label: o.label })),
  });

  // Skipped outright when there is nothing to choose between. A question whose
  // answer is forced is worse than no question: it costs a tap and teaches the
  // person that the stylist is not really listening.
  if (hasDresses(ctx.wardrobe)) {
    steps.push({
      key: 'silhouette',
      question: 'Dress, or trousers?',
      options: SILHOUETTES.map((s) => ({ key: s.key, label: s.label })),
    });
  }

  steps.push({
    key: 'mood',
    question: 'And the mood?',
    options: MOODS.map((m) => ({ key: m.key, label: m.label })),
  });

  if (ctx.weather) {
    steps.push({
      key: 'weather',
      question: `${weatherLine(ctx.weather, ctx.temperature)} Should I dress you for it?`,
      options: WEATHER_ANSWERS.map((w) => ({ key: w.key, label: w.label })),
    });
  }

  return steps;
}

/** The label a chosen key was shown under — echoed back as the user's turn. */
export function optionLabel(step: Step, key: string): string {
  return step.options.find((o) => o.key === key)?.label ?? key;
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

/**
 * The facts the beam search needs, taken straight from the tapped answers
 * rather than re-read out of the sentence.
 */
export type BriefIntent = {
  targetFormality: number | null;
  targetOccasion: string | null;
};

export type ComposedAsk = {
  /** The sentence shown as the user's message and parsed on device. */
  message: string;
  brief?: StylistBrief;
  intent?: BriefIntent;
  /** Fixed steps completed — bounded, so it is safe to measure. */
  steps: number;
};

const findOccasion = (key: string): OccasionOption | undefined =>
  [...OCCASIONS, ...EVENT_OCCASIONS].find((o) => o.key === key);

/**
 * The two answers that need no questions.
 *
 * "Surprise me" is not a shortcut around the questionnaire, it is a different
 * request — the person is asking to be shown something, not to specify it, and
 * putting four questions in front of that would be the joke-killing kind of
 * thorough.
 */
const UNPROMPTED: Record<'surprise' | 'browse', string> = {
  surprise:
    'Surprise me. Put together something from my closet I would not have thought of myself.',
  browse: 'What am I not wearing enough of, and what is missing?',
};

/** Fold the tapped answers into one request. */
export function composeAsk(entry: EntryKey, answers: Answers): ComposedAsk {
  if (entry === 'surprise' || entry === 'browse') {
    return { message: UNPROMPTED[entry], steps: 0 };
  }

  const occasion = answers.occasion ? findOccasion(answers.occasion) : undefined;
  const silhouette = SILHOUETTES.find((s) => s.key === answers.silhouette);
  const mood = MOODS.find((m) => m.key === answers.mood);
  const dressForWeather = answers.weather ? answers.weather === 'outside' : undefined;

  // Written as a sentence a person would plausibly type, because it is shown to
  // them as their own message. "occasion=dinner; mood=dark" is accurate and
  // reads like a form submission, which undoes everything the chips bought.
  const clauses: string[] = [];
  clauses.push(occasion ? occasion.phrase : 'Help me get dressed.');

  const shape = [silhouette?.phrase, mood ? `something ${mood.phrase}` : '']
    .filter(Boolean)
    .join(', ');
  if (shape) clauses.push(`I want ${shape}.`);

  if (dressForWeather === false) clauses.push('I will be inside most of it.');

  return {
    message: clauses.join(' '),
    brief: {
      occasion: answers.occasion ?? 'unspecified',
      silhouette: silhouette?.key,
      mood: mood?.key,
      dressForWeather,
    },
    intent: {
      targetFormality: occasion?.formality ?? null,
      targetOccasion: occasion?.occasion ?? null,
    },
    steps: Object.keys(answers).length,
  };
}
