import { formatTemp } from '@/features/context/weather';
import type { WeatherContext } from '@/lib/styling';


/**
 * What the stylist says before anyone has said anything.
 *
 * The opening carries more weight than any other line in the app, because it is
 * the only one everybody reads. It has one job: make the next move obvious
 * without making it feel like work. So it greets, it says one true thing about
 * the day it already knows, and it offers four doors.
 *
 * Nothing here is a model call. The greeting is a lookup and the doors are
 * fixed, so the sheet is fully useful the instant it opens — which is the
 * difference between a stylist and a loading state.
 */

export type Greeting = {
  /** "Morning." — set in the serif, on its own line. */
  salutation: string;
  /** The line underneath. One sentence, sometimes about the weather. */
  line: string;
};

type Slot = 'earlyMorning' | 'morning' | 'afternoon' | 'evening' | 'night';

function slotFor(hour: number): Slot {
  if (hour < 5) return 'night';
  if (hour < 9) return 'earlyMorning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

/**
 * Three readings per slot, rotated by the date.
 *
 * Rotated rather than randomised on purpose. Random would re-roll on every
 * re-render and make the header flicker; the date means the line is stable all
 * day and different tomorrow, which is the version of novelty that reads as
 * someone being there rather than a shuffle animation.
 */
const LINES: Record<Slot, string[]> = {
  earlyMorning: [
    'What is the plan today?',
    'What are we dressing for?',
    'Where are you headed first?',
  ],
  morning: [
    'What is the plan today?',
    'What does the day hold?',
    'What are you dressing for?',
  ],
  afternoon: [
    'What is left of the day?',
    'Something for later, or for now?',
    'What are we dressing for?',
  ],
  evening: [
    'Going out, or staying in?',
    'What is tonight?',
    'Something for this evening?',
  ],
  // No "still up" here. The weather aside can precede any of these, and a
  // remark about the hour stacked on a remark about the rain is two
  // observations where the line has room for one.
  night: [
    'Planning tomorrow?',
    'Something for tomorrow?',
    'What is tomorrow asking for?',
  ],
};

const SALUTATIONS: Record<Slot, string> = {
  earlyMorning: 'Morning',
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Late one',
};

/**
 * The weather sentence, when there is one worth saying.
 *
 * Only fires on a reading a person would actually mention — cold enough,
 * warm enough, wet enough, or a day that cannot be dressed once. A stylist
 * announcing "it is 64° and mild" is a weather widget with a personality
 * setting, and the silence when the day is unremarkable is what makes the
 * remark land when it comes.
 */
export function weatherAside(weather: WeatherContext | null, units: 'C' | 'F' = 'F'): string | null {
  if (!weather) return null;
  const temp = formatTemp(weather.feelsLikeC, units);

  if (weather.precipitationChance >= 0.5) return `Rain is likely — ${temp} out.`;
  if (weather.feelsLikeC <= 4) return `It is ${temp} out. Layers, then.`;
  if (weather.feelsLikeC >= 26) return `It is ${temp} out. Light and loose.`;
  if (weather.swing) return `${temp} now, and a long way from where it ends up.`;
  return null;
}

/**
 * The profile's own question, when there is one to ask.
 *
 * "Class today, or going out?" is the founder's ask made literal — the
 * opening line naming the occasions the person picked, so the profile is
 * visibly listened to before a single tap. Built from the FIRST TWO picks
 * (selection order is the person's own emphasis), day slots only: the
 * evening and night lines already ask sharper questions than a roster
 * could, and a 1 a.m. "Game day, or class?" reads like a bot with a list.
 */
export function lifestyleOpeningLine(
  slot: Slot,
  labels: readonly string[],
): string | null {
  if (labels.length < 2) return null;
  if (slot === 'evening' || slot === 'night') return null;
  const [a, b] = labels as [string, string];
  return `${a} today, or ${b.toLowerCase()}?`;
}

export function greeting({
  now,
  weather,
  units = 'F',
  lifestyleLabels = [],
}: {
  now: Date;
  weather: WeatherContext | null;
  units?: 'C' | 'F';
  /** The picked occasions' display labels, in selection order. */
  lifestyleLabels?: readonly string[];
}): Greeting {
  const slot = slotFor(now.getHours());
  // The lifestyle line joins the rotation rather than replacing it — the
  // same one-line-a-day cadence, one more voice in it. Joining (not
  // leading) is deliberate: a greeting that names your occasions every
  // single day stops reading as attention and starts reading as a template.
  const personal = lifestyleOpeningLine(slot, lifestyleLabels);
  const options = personal ? [...LINES[slot], personal] : LINES[slot];
  // Day of the month is enough rotation and needs no date maths.
  const line = options[now.getDate() % options.length] ?? options[0]!;

  const aside = weatherAside(weather, units);

  return {
    salutation: SALUTATIONS[slot],
    line: aside ? `${aside} ${line}` : line,
  };
}

/**
 * The four doors.
 *
 * Four, not eight. The point of an opening chip is that it can be read whole
 * without deciding anything — past about five options a chip row stops being an
 * invitation and becomes a menu, which is the thing a chat was supposed to
 * replace.
 *
 * They are ordered by how little the person knows about what they want:
 * someone who has an event has already done half the thinking, someone who is
 * browsing has done none, and "help me get dressed" is the default because it
 * is the reason the app exists.
 */
/**
 * THE FOUR DOORS MOVED TO `stylist-spec.ts` — redesign 16.
 *
 * They were four text rows keyed by `EntryKey`: dressed, event, surprise,
 * browse. The accepted design replaces them with four image-led cards named
 * for what somebody actually came to do — what should I wear, pack for a trip,
 * make this piece work, ask about my closet — and each maps to a path that
 * already exists and already works.
 *
 * `EntryKey` and `buildSteps` are UNTOUCHED. `event`, `surprise` and `browse`
 * lose their door, not their capability: `event`'s occasions are reachable
 * through the first questionnaire step, and the other two were prompts rather
 * than doors. Nothing was deleted from the model to change a surface.
 *
 * The doors live in the spec because which door exists, in which order, and
 * whether tapping one can reach a model are POLICY — and policy that a test
 * can execute is worth more than policy a component happens to render.
 */
export { DOORS } from './stylist-spec';
