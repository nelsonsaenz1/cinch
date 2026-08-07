import type { Place } from '@/features/context/weather';

/**
 * The packing questionnaire — what Cinch asks before it packs anything.
 *
 * Packing used to open on a text field and, for a closet with fewer than eight
 * pieces in it, on a button that launched the camera. Both are the same mistake
 * in two costumes: the screen demanded work before it offered any thinking. A
 * trip is the one styling problem people can actually describe — where, who
 * with, what kind of thing it is, how long, and which parts of the day need
 * dressing — so this asks, one question at a time, and every answer but the
 * destination is a tap.
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
 * The number travels with the option rather than being recovered from the
 * composed sentence later — the same rule the stylist's occasions follow. A
 * tapped "wedding" must rank as a 5 even if the prose it produced says
 * "celebration".
 */
export const VIBES = [
  { key: 'beach', label: 'Sun and sea', phrase: 'a beach trip', formality: 2 },
  { key: 'city', label: 'City and culture', phrase: 'a city break', formality: 3 },
  { key: 'outdoors', label: 'Mountains and outdoors', phrase: 'an outdoors trip', formality: 1 },
  { key: 'work', label: 'Work', phrase: 'a work trip', formality: 4 },
  { key: 'occasion', label: 'A wedding or an event', phrase: 'a trip built around an occasion', formality: 5 },
  { key: 'home', label: 'Seeing family', phrase: 'a trip home', formality: 2 },
] as const;

export type VibeKey = (typeof VIBES)[number]['key'];

/** Trip lengths, in days. Open-Meteo's free forecast reaches 16. */
export const TRIP_LENGTHS = [2, 3, 5, 7, 10, 14] as const;

/**
 * The parts of the day that need dressing.
 *
 * The only multi-select question, and the one the founder asked for by name.
 * A beach week is mornings and days; a wedding weekend is days and nights.
 * Packing for all three when only two are wanted is exactly the over-packing
 * this screen exists to stop.
 */
export const DAY_PARTS = [
  { key: 'morning', label: 'Mornings', title: 'Mornings', phrase: 'mornings' },
  { key: 'day', label: 'Days', title: 'Days', phrase: 'daytime' },
  { key: 'night', label: 'Nights', title: 'Nights', phrase: 'evenings' },
] as const;

export type DayPartKey = (typeof DAY_PARTS)[number]['key'];

/** Every question in order. `destination` is the search; the rest are chips. */
export type TripStepKey = 'destination' | 'companions' | 'vibe' | 'length' | 'parts';

export const TRIP_STEPS: readonly TripStepKey[] = [
  'destination',
  'companions',
  'vibe',
  'length',
  'parts',
] as const;

/** What the stylist says at each step. One line, its own voice, no wizard cruft. */
export const TRIP_QUESTIONS: Record<TripStepKey, string> = {
  destination: 'Where are you going?',
  companions: 'Who is going with you?',
  vibe: 'What kind of trip is it?',
  length: 'How long are you there?',
  parts: 'Which parts of the day need dressing?',
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
  vibe: VibeKey;
  days: number;
  /** At least one, in `DAY_PARTS` order. */
  parts: DayPartKey[];
};

export const companionOf = (key: CompanionKey) =>
  COMPANIONS.find((c) => c.key === key) ?? COMPANIONS[0];

export const vibeOf = (key: VibeKey) => VIBES.find((v) => v.key === key) ?? VIBES[1];

export const dayPartOf = (key: DayPartKey) =>
  DAY_PARTS.find((p) => p.key === key) ?? DAY_PARTS[1];

/** The target formality for the on-device capsule, taken from the tapped vibe. */
export const formalityFor = (trip: Trip): number => vibeOf(trip.vibe).formality;

/**
 * The trip as one plain sentence, for the model and for the screen's own
 * colophon. Written the way a person would say it rather than as a key list —
 * the same reasoning as `composeAsk`: the keys travel separately, structured,
 * so the prose is free to read like prose.
 */
export function describeTrip(trip: Trip): string {
  const where = [trip.destination.name, trip.destination.country].filter(Boolean).join(', ');
  const parts = trip.parts.map((p) => dayPartOf(p).phrase);
  const partList =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

  return (
    `${trip.days} days in ${where}, ${companionOf(trip.companions).phrase}, ` +
    `${vibeOf(trip.vibe).phrase}. Dressing for ${partList}.`
  );
}

/**
 * `LISBON · 5 DAYS · CITY BREAK` — the kicker over the packed trip.
 *
 * The destination leads because the serif line under this kicker belongs to
 * the brief's read of the place, not to the place name — so the kicker is
 * where "Lisbon" gets said at all. Companions are deliberately absent: they
 * travel to the model in `describeTrip`, but the atlas prints three fragments
 * here, and who you're with is the one answer that doesn't change what the
 * page shows.
 */
export function tripColophon(trip: Trip): string {
  return [trip.destination.name, `${trip.days} days`, vibeOf(trip.vibe).label].join(' · ');
}
