import type { Place } from '@/features/context/weather';

/**
 * The packing questionnaire — what Cinch asks before it packs anything.
 *
 * Packing used to open on a text field and, for a closet with fewer than eight
 * pieces in it, on a button that launched the camera. Both are the same mistake
 * in two costumes: the screen demanded work before it offered any thinking. A
 * trip is the one styling problem people can actually describe — where, who
 * with, when, and what kind of thing it is — so this asks, one question at a
 * time, and every answer but the destination is a tap.
 *
 * SAME GRAMMAR AS THE STYLIST'S OWN QUESTIONNAIRE (features/stylist/
 * questionnaire.ts), deliberately: fixed vocabularies, keys rather than prose
 * on the wire, and the whole flow scripted on device so nothing costs a model
 * call until the brief itself. The two are not shared code because they ask
 * about different things — one is about a day, this is about a place — but a
 * reader who knows one should recognise the other immediately.
 *
 * Free text appears exactly once, in the destination search, and even there the
 * answer is a `Place` chosen from a geocoder rather than the string typed.
 *
 * FOUR QUESTIONS, NOT FIVE, and the fourth asks two things at once — see
 * docs/design/membership-packing-contract.md §4. The change that matters is
 * the third: this used to ask trip *length* from a list of round numbers, which
 * cannot be turned into a forecast. A real forecast needs real dates.
 */

// ---------------------------------------------------------------------------
// The closed vocabularies
// ---------------------------------------------------------------------------

/**
 * Who is on the trip.
 *
 * Not a party size. "With friends" and "with your partner" ask for genuinely
 * different clothes, where "4 people" asks for none — it is a fact about the
 * booking, not about getting dressed.
 *
 * The atlas prints this answer as "Nadia and Tom", which is a display, not an
 * input: names change nothing about what to wear, so the engine reads the key
 * and the screen prefers the names when friends were attached (`friendNames`).
 * No name is ever typed here and none is ever invented.
 */
export const COMPANIONS = [
  { key: 'solo', label: 'On my own', phrase: 'travelling on my own' },
  { key: 'partner', label: 'With my partner', phrase: 'with my partner' },
  { key: 'friends', label: 'With friends', phrase: 'with friends' },
  { key: 'family', label: 'With family', phrase: 'with family' },
  { key: 'work', label: 'With colleagues', phrase: 'with colleagues' },
] as const;

export type CompanionKey = (typeof COMPANIONS)[number]['key'];

/**
 * The vibe, carrying the formality the on-device engine ranks on.
 *
 * MULTI-SELECT, unlike the single choice this replaced — "Pick as many as are
 * true", because a trip genuinely is a warm city AND long dinners AND a lot of
 * walking, and forcing one answer threw away the other two.
 *
 * The number travels with the option rather than being recovered from the
 * composed sentence later — the same rule the stylist's occasions follow. A
 * tapped "wedding" must rank as a 5 even if the prose it produced says
 * "celebration".
 */
export const VIBES = [
  { key: 'warm-city', label: 'Warm city', phrase: 'a warm city', formality: 3 },
  { key: 'work', label: 'Work', phrase: 'work', formality: 4 },
  { key: 'long-dinners', label: 'Long dinners', phrase: 'long dinners', formality: 4 },
  { key: 'beach', label: 'Beach', phrase: 'the beach', formality: 2 },
  { key: 'wedding', label: 'Wedding', phrase: 'a wedding', formality: 5 },
  { key: 'walking', label: 'A lot of walking', phrase: 'a lot of walking', formality: 2 },
] as const;

export type VibeKey = (typeof VIBES)[number]['key'];

/**
 * The parts of the day that need dressing.
 *
 * `title` is the row label on the memo, which is why "Evening" is asked for and
 * "Night" is printed: the chip names the part of the day you are choosing, the
 * memo row names the look.
 *
 * `formalityOffset` moves the trip's own formality for that part. An evening
 * out is dressier than the same trip's afternoon, and nobody packs a suit for
 * the gym — but the offset is applied to whatever the trip already is, so a
 * wedding's daytime still outranks a beach trip's evening.
 */
export const DAY_PARTS = [
  { key: 'daytime', label: 'Daytime', title: 'Day', phrase: 'daytime', formalityOffset: 0 },
  { key: 'evening', label: 'Evening', title: 'Night', phrase: 'evenings', formalityOffset: 1 },
  { key: 'gym', label: 'Gym', title: 'Gym', phrase: 'the gym', formalityOffset: -2 },
  {
    key: 'travel',
    label: 'Travel days',
    title: 'Travel',
    phrase: 'travel days',
    formalityOffset: -1,
  },
] as const;

export type DayPartKey = (typeof DAY_PARTS)[number]['key'];

/**
 * Every question in order.
 *
 * `shape` is the one screen that asks two things — the vibe and the day parts —
 * because they are the same decision seen from two sides, and because the
 * running arithmetic under them ("two day parts across four days is eight
 * looks") only means anything once both are on screen.
 */
export type TripStepKey = 'destination' | 'companions' | 'dates' | 'shape';

export const TRIP_STEPS: readonly TripStepKey[] = [
  'destination',
  'companions',
  'dates',
  'shape',
] as const;

/** What the stylist says at each step. One line, its own voice, no wizard cruft. */
export const TRIP_QUESTIONS: Record<TripStepKey, string> = {
  destination: 'Where are you going?',
  companions: 'Who is going with you?',
  dates: 'When are you there?',
  shape: "What's the vibe? And which parts of the day?",
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * A calendar day, `YYYY-MM-DD`, in the DESTINATION's calendar rather than an
 * instant on a timeline.
 *
 * A `Date` here would be a bug waiting for a traveller: "12 September" stored
 * as midnight local and read in another zone is 11 September, and the whole
 * point of this question is that the forecast covers the right days. Open-Meteo
 * takes `start_date`/`end_date` in exactly this format, so the string is also
 * what goes on the wire — no round trip through a timestamp at all.
 */
export type IsoDate = string;

export const toIsoDate = (d: Date): IsoDate => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Parsed as local noon, which no timezone shift can push onto another day. */
export const fromIsoDate = (iso: IsoDate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
};

export const addDays = (iso: IsoDate, n: number): IsoDate => {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
};

/** Inclusive of both ends: 12th to 15th is four days, which is what people mean. */
export function daysBetween(startsOn: IsoDate, endsOn: IsoDate): number {
  const ms = fromIsoDate(endsOn).getTime() - fromIsoDate(startsOn).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

/**
 * `12–15 Sept` — an en dash, and the month said once when it does not change.
 *
 * Locale-formatted rather than hand-built from a month table, so a device set
 * to French says "sept." on its own terms.
 */
export function formatDateRange(startsOn: IsoDate, endsOn: IsoDate): string {
  const a = fromIsoDate(startsOn);
  const b = fromIsoDate(endsOn);
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

  return sameMonth
    ? `${a.getDate()}–${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

/** "12–15 Sept · 4 days", the summary row's own line. */
export const describeDates = (startsOn: IsoDate, endsOn: IsoDate): string => {
  const days = daysBetween(startsOn, endsOn);
  return `${formatDateRange(startsOn, endsOn)} · ${days} ${days === 1 ? 'day' : 'days'}`;
};

// ---------------------------------------------------------------------------
// The answered trip
// ---------------------------------------------------------------------------

/**
 * A finished questionnaire.
 *
 * Everything the brief and the packing engine need, and nothing else. There is
 * no free-text field on purpose: the only thing a user types is a place name,
 * and what is kept is the geocoder's answer.
 */
export type Trip = {
  destination: Place;
  companions: CompanionKey;
  /** Cinch friends travelling too. Empty is the normal case, not an error. */
  friendIds: string[];
  /** Display only, in `friendIds` order. Never sent to the model. */
  friendNames: string[];
  startsOn: IsoDate;
  endsOn: IsoDate;
  /** At least one, in `VIBES` order. */
  vibes: VibeKey[];
  /** At least one, in `DAY_PARTS` order. */
  parts: DayPartKey[];
};

export const companionOf = (key: CompanionKey) =>
  COMPANIONS.find((c) => c.key === key) ?? COMPANIONS[0];

export const vibeOf = (key: VibeKey) => VIBES.find((v) => v.key === key) ?? VIBES[0];

export const dayPartOf = (key: DayPartKey) =>
  DAY_PARTS.find((p) => p.key === key) ?? DAY_PARTS[0];

export const tripDays = (trip: Trip): number => daysBetween(trip.startsOn, trip.endsOn);

/**
 * The target formality for the on-device capsule: the HIGHEST of the tapped
 * vibes.
 *
 * A trip with a wedding in it is a 5 even when it is also a beach, because the
 * wedding is the thing you cannot turn up to underdressed. Averaging would pack
 * for neither.
 */
export function formalityFor(trip: Trip): number {
  return trip.vibes.reduce((max, key) => Math.max(max, vibeOf(key).formality), 1);
}

/** The trip's formality as one part of the day wants it, clamped to the scale. */
export function formalityForPart(trip: Trip, part: DayPartKey): number {
  const shifted = formalityFor(trip) + dayPartOf(part).formalityOffset;
  return Math.min(5, Math.max(1, shifted));
}

/** "Nadia and Tom", or "with friends" when nobody was named. */
export function describeCompanions(trip: Trip): string {
  const names = trip.friendNames;
  if (!names.length) return companionOf(trip.companions).phrase;
  if (names.length === 1) return `with ${names[0]}`;
  return `with ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The trip as one plain sentence, for the model and for the screen's own
 * colophon. Written the way a person would say it rather than as a key list —
 * the same reasoning as `composeAsk`: the keys travel separately, structured,
 * so the prose is free to read like prose.
 */
export function describeTrip(trip: Trip): string {
  const where = [trip.destination.name, trip.destination.country].filter(Boolean).join(', ');
  const list = (items: string[]) =>
    items.length === 1
      ? items[0]!
      : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

  const vibes = list(trip.vibes.map((v) => vibeOf(v).phrase));
  const parts = list(trip.parts.map((p) => dayPartOf(p).phrase));

  return (
    `${tripDays(trip)} days in ${where}, ${companionOf(trip.companions).phrase}. ` +
    `It's ${vibes}. Dressing for ${parts}.`
  );
}

/**
 * `LISBON · 4 DAYS · WARM CITY` — the kicker over the packed trip.
 *
 * The destination leads because the serif line under this kicker belongs to
 * the brief's read of the place, not to the place name — so the kicker is
 * where "Lisbon" gets said at all. Companions are deliberately absent: they
 * travel to the model in `describeTrip`, but the atlas prints three fragments
 * here, and who you're with is the one answer that doesn't change what the
 * page shows. The first tapped vibe stands for the rest for the same reason —
 * three is the number of fragments that fits.
 */
export function tripColophon(trip: Trip): string {
  const days = tripDays(trip);
  const lead = trip.vibes[0];
  return [
    trip.destination.name,
    `${days} ${days === 1 ? 'day' : 'days'}`,
    lead ? vibeOf(lead).label : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * "Lisbon, 12–15 Sept, 4 days." — PK-02's restatement of the trip, under the
 * question.
 *
 * The trip facts are restated so the answer is given IN CONTEXT: the fourth
 * question asks what the evenings are for, and that is unanswerable without
 * remembering how many of them there are. Every fragment is an answer already
 * given, so nothing here can be a guess; fragments the draft does not yet
 * carry are dropped rather than filled.
 *
 * DAYS, NOT NIGHTS. The atlas writes "six nights"; `daysBetween` is inclusive
 * of both ends and every other surface in the app — the summary row, the
 * colophon, the memo — says days. Two units for one trip inside one flow is
 * the kind of drift `looksSentence` exists to stop.
 */
export function restateTrip(draft: {
  destination?: { name: string } | null;
  startsOn?: IsoDate | null;
  endsOn?: IsoDate | null;
}): string | null {
  const parts: string[] = [];
  if (draft.destination?.name) parts.push(draft.destination.name);
  if (draft.startsOn && draft.endsOn) parts.push(describeDates(draft.startsOn, draft.endsOn));
  return parts.length ? `${parts.join(', ')}.` : null;
}
