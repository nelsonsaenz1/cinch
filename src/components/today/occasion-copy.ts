/**
 * THE OCCASION INTERRUPT'S WORDS — T-02.
 *
 * "The occasion is an interrupt, not a tab and not a second plate: it takes the
 * tray, sits above the look it competes with, and offers exactly one action."
 *
 * Every field here is read off a real occasion (`EventSummary`, from
 * `features/events/queries.ts`) rather than off the device calendar, because
 * the one action the interrupt offers — dress for it instead — lands on
 * `/event/[id]/outfits`, which only a Cinch occasion has. A calendar entry has
 * no such destination, and an interrupt whose action goes nowhere is worse than
 * no interrupt at all.
 *
 * Pure, and primitives only, so it can be tested without React Native in the
 * bundle. Two refusals live in it:
 *
 *   * The attendance count is printed only when there is a real one to print.
 *     A solo occasion says nothing rather than "1 going".
 *   * The occasion word in the action comes from the occasion's own `occasion`
 *     field. When the row does not carry one the action says "the occasion",
 *     never a noun guessed out of the title.
 */

/** "7pm", "7:30pm" — the same clock the weather strip's event rows use. */
export function clockLabel(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`;
}

/**
 * "Tonight", "Today", or the weekday — the three variants the component
 * inventory lists. Evening starts at 17:00, which is when "tonight" stops
 * being a forecast and starts being a plan.
 */
export function whenEyebrow(startsAt: Date | null, now: Date): string {
  if (!startsAt) return 'Coming up';
  const sameDay = startsAt.toDateString() === now.toDateString();
  if (sameDay) return startsAt.getHours() >= 17 ? 'Tonight' : 'Today';
  return startsAt.toLocaleDateString('en-US', { weekday: 'long' });
}

export type OccasionInterruptCopy = {
  eyebrow: string;
  /** "Dinner at Bar Ilios, 7pm" — never a placeholder day or a guessed hour. */
  line: string;
  /** "Four going." — absent when there is nobody else to count. */
  going: string | null;
  body: string;
  action: string;
};

const WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
];

export function occasionInterruptCopy(
  occasion: {
    title: string;
    venueName?: string | null;
    startsAt: Date | null;
    memberCount: number;
    occasion?: string | null;
  },
  now: Date,
): OccasionInterruptCopy {
  const venue = occasion.venueName ? ` at ${occasion.venueName}` : '';
  const time = occasion.startsAt ? `, ${clockLabel(occasion.startsAt)}` : '';

  return {
    eyebrow: whenEyebrow(occasion.startsAt, now),
    line: `${occasion.title}${venue}${time}`,
    going:
      occasion.memberCount > 1
        ? `${WORDS[occasion.memberCount] ?? occasion.memberCount} going.`
        : null,
    body: "Today's look is built for the day; the occasion has its own.",
    action: `Dress for ${occasion.occasion ? `the ${occasion.occasion}` : 'the occasion'} instead`,
  };
}
