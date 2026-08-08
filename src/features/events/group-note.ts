/**
 * The stylist's group note — Event Detail State Atlas E-07.
 *
 * Computed, never authored. The convergence is the hue FAMILY of each
 * attendee's leading look's heaviest garment — family, not colour name, so
 * "ecru" and "cream" count as the same room — and the colour it names is the
 * commonest name inside that family. The viewer's own difference is read off
 * her own heaviest piece outside that family.
 *
 * Three sentences for three situations — you're in the set, you're the
 * exception, you haven't picked — and silence for the fourth: fewer than two
 * boards with a colour on file, or no family shared by at least two
 * attendees. An invented pattern would be the one lie on a page whose whole
 * promise is that the numbers are real.
 *
 * Pure and decoupled from `@/features/event-outfits/types` on purpose: this
 * is Unit D's module (event-social-contract.md §7 — "the group note" is
 * listed under Event Detail), while `PostedLook`/`AttendeeBoard` live in
 * Unit E's `components/event-outfits/**` territory. Callers reduce whatever
 * shape they hold (a `PostedLook`'s garments, a board's leading look) down to
 * `NoteBoard` before calling in — see `event/[id]/index.tsx`.
 */

import type { Garment } from '@/lib/styling';

export interface NoteBoard {
  userId: string;
  /** The garments of the one look this board is being read for — usually the
   *  board's pick-leader, or its first look when nothing has been picked. */
  garments: readonly Garment[];
}

/** "Two" for 2 — small counts read as words in the stylist's voice. */
const COUNT_WORDS = ['', '', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'] as const;
const countWord = (n: number): string => COUNT_WORDS[n] ?? String(n);

/** The heaviest garment of a look — the piece that decides what it reads as. */
function anchorOf(garments: readonly Garment[]): Garment | null {
  return [...garments].sort((a, b) => b.visualWeight - a.visualWeight)[0] ?? null;
}

export function groupStyleNote(boards: readonly NoteBoard[], viewerId: string | null): string | null {
  type Entry = { userId: string; family: string; colour: string; garments: readonly Garment[] };

  const entries: Entry[] = [];
  for (const board of boards) {
    const anchor = anchorOf(board.garments);
    const colour = anchor?.colors[0];
    if (!colour?.family || !colour.name) continue;
    entries.push({ userId: board.userId, family: colour.family, colour: colour.name, garments: board.garments });
  }
  if (entries.length < 2) return null;

  const byFamily = new Map<string, Entry[]>();
  for (const e of entries) byFamily.set(e.family, [...(byFamily.get(e.family) ?? []), e]);

  const [family, group] = [...byFamily.entries()].sort((a, b) => b[1].length - a[1].length)[0]!;
  if (group.length < 2) return null;

  // The commonest colour NAME inside the shared family is what to call it.
  const nameCounts = new Map<string, number>();
  for (const e of group) nameCounts.set(e.colour, (nameCounts.get(e.colour) ?? 0) + 1);
  const colour = [...nameCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  const count = countWord(group.length);

  const mine = viewerId ? entries.find((e) => e.userId === viewerId) : undefined;

  if (mine && mine.family === family) {
    const contrast = [...mine.garments]
      .sort((a, b) => b.visualWeight - a.visualWeight)
      .find((g) => g.colors[0]?.family && g.colors[0].family !== family);
    const piece = contrast?.subcategory ?? contrast?.category;
    const contrastColour = contrast?.colors[0]?.name;
    return contrastColour && piece
      ? `${count} of you are in ${colour}. Yours reads differently with the ${contrastColour} ${piece}.`
      : `${count} of you are in ${colour} — yours will read as part of the set.`;
  }

  if (mine) {
    return `${count} of them are in ${colour}. Yours is the ${mine.colour} in the room.`;
  }

  return `${count} of them are already in ${colour} — worth knowing before you pick.`;
}
