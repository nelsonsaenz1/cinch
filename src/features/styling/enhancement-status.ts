import type { StylingStatus } from './use-outfits';

/**
 * What the re-rank query looks like at one instant, in the only terms the
 * status decision is allowed to read.
 *
 * Deliberately primitives rather than the query object: the bug this shape
 * exists to prevent was a *state* misread, not a network fault, and a state
 * misread is only provable if the state is expressible without a QueryClient.
 */
export type EnhancementPhase = {
  /** The model refused for want of AI consent. Not a network condition. */
  consentRequired: boolean;
  /** `decision.enhance` — whether a question was asked at all. */
  requested: boolean;
  /**
   * The query threw. A transport error never reaches the function, so this is
   * the ONE signal in this hook that genuinely means "could not be reached".
   */
  errored: boolean;
  /**
   * A response for THIS query key has landed. False covers every pre-answer
   * moment: the first render after the key changed, the gap before the fetch
   * is flagged in flight, a paused fetch.
   */
  answered: boolean;
  /** The landed response carried usable picks. */
  usable: boolean;
  /** A request is in flight right now. */
  fetching: boolean;
  /** How a landed-but-unusable response should read. */
  failed: StylingStatus;
};

/**
 * The status of an enhancement, for everything that can be decided BEFORE the
 * merge runs. `null` means the answer is usable and the merge itself decides
 * between `'ai'` and `'local'`.
 *
 * WHY THIS IS A FUNCTION AND NOT FOUR LINES IN THE MEMO
 * ----------------------------------------------------
 * Because it was four lines in the memo, and one of them was wrong in a way
 * nothing could catch. `'offline'` is the status that disables the reaction
 * controls on Today and paints "unavailable without a connection". It was
 * reached by falling through — anything that was not an error, not un-asked
 * and not a usable answer landed on it, INCLUDING the ordinary window where a
 * query has simply not answered yet.
 *
 * That window is not hypothetical. A wear invalidates the wardrobe; the
 * shortlist recomputes without the garments just worn; the re-rank's query key
 * (`['outfit-rerank', <candidate ids>, …]`) therefore changes identity; the new
 * key has no cache, so for the render(s) before the fetch is flagged in flight
 * there is no data, no error and no `isFetching`. The old fall-through called
 * that offline, and a person who had just worn an outfit on a perfectly good
 * connection watched the taste controls grey out.
 *
 * So the rule is inverted: `'offline'` must be CLAIMED, by an error or by a
 * response that actually says it failed. Silence is `'enhancing'` — which is
 * what it has always literally meant, and which leaves the controls alone.
 */
export function enhancementStatus(phase: EnhancementPhase): StylingStatus | null {
  if (phase.consentRequired) return 'consent_required';
  // An error is the only unprompted claim of an outage this hook can make.
  if (phase.errored) return 'offline';
  // Nothing was asked, so nothing is missing. The outfits are complete.
  if (!phase.requested) return 'local';
  // Asked, no answer yet. The one branch this whole module exists for: an
  // unanswered question is a question in progress, never a network verdict.
  if (!phase.answered) return 'enhancing';
  // Answered, and the answer was empty. A refetch over a stale empty answer is
  // still in progress; anything else is the failure the function reported.
  if (!phase.usable) return phase.fetching ? 'enhancing' : phase.failed;
  return null;
}
