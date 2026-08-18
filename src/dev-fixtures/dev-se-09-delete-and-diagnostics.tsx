import { SeFrame } from './se-frames';

/**
 * DEV ONLY · SE-09 — the typed-DELETE card over a paid account, and the page's
 * bottom with no build number.
 *
 * `cinch:///dev-se-09-delete-and-diagnostics`. The count is named precisely
 * because it was actually read; a closet that could not be read gets "every
 * piece" instead. The paid clause appears only because the subscription truth
 * is known, and it says the thing a deletion flow is most tempted to leave out:
 * Apple bills the membership, and deleting here does not cancel it.
 *
 * Behind the card, the edition mark is "Cinch 1.8.0" — no build number exists
 * in this context, so the parenthetical is dropped rather than padded with a
 * placeholder. Dismiss the card and open the diagnostics row to see all five
 * facts the summary line stands for.
 */
export default function DevSe09DeleteAndDiagnostics() {
  return <SeFrame deleteOpen build={null} />;
}
