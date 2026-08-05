import { formatTemp } from '@/features/context/weather';
import type { WeatherContext } from '@/lib/styling';

import type { EntryKey } from './questionnaire';

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

export function greeting({
  now,
  weather,
  units = 'F',
}: {
  now: Date;
  weather: WeatherContext | null;
  units?: 'C' | 'F';
}): Greeting {
  const slot = slotFor(now.getHours());
  const options = LINES[slot];
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
export const QUICK_STARTS: { key: EntryKey; label: string }[] = [
  { key: 'dressed', label: 'Help me get dressed' },
  { key: 'event', label: 'I have an event' },
  { key: 'surprise', label: 'Surprise me' },
  { key: 'browse', label: 'Just browsing' },
];
