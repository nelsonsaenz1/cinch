/**
 * DS-05 — the three failures that end a Describe search, told apart.
 *
 * "The three failures that end a search are drawn together because their
 * difference is the point: offline is a delay, a declined consent is a choice
 * the user made and can revisit, and a missing partner is nobody's fault."
 *
 * One generic red line said none of that. It named no cause, offered no way
 * back, and read as the app failing in all three cases — including the one
 * where nothing failed at all, because the user had told Cinch not to send the
 * text anywhere and Cinch obeyed.
 *
 * WHY THIS IS A PURE MODULE
 *
 * The classification is the part that can be wrong, and it is exactly the part
 * a rendering test cannot reach without a network stack, a kv-store and a
 * device. Split out, the whole decision is a function of three booleans and one
 * string, and `tests/search-failure.test.ts` walks every combination of them.
 *
 * WHAT THIS FILE DOES NOT DO: change what is sent, what is stored, or when a
 * search runs. The causes were all already detectable; nothing here is a new
 * signal, and no notice below promises anything the app does not already do.
 */

export type SearchFailureCause = 'offline' | 'consent_declined' | 'partner_unavailable';

/**
 * CONSENT NO LONGER STOPS A SEARCH, and this file is where that changed.
 *
 * The `consent_declined` notice below was accurate when it was written: search
 * went through a model, the model needed AI-processing consent, and a user who
 * had switched that off was told so. Packet 1 moved `action: 'search'` above
 * the consent gate on the server, because the catalogue matcher is not AI
 * processing — the typed words go to Cinch and to the licensed shop catalogue,
 * which is what `TYPED_PRIVACY` now says on screen.
 *
 * So the notice's own sentence — "Cinch will not send this text anywhere" — is
 * no longer the reason a search did not happen, and showing it would be telling
 * somebody their choice blocked something their choice does not block. The
 * classification below therefore ignores consent for SEARCH; the notice text is
 * kept because DS-05's fixture route still renders all three, and because the
 * consent state itself is unchanged and still governs the spoken path and
 * tagging.
 *
 * §11 of the CPV2 handoff states the rule this enforces: implementation must
 * not assume "that AI-processing consent gates typed search".
 */

export type SearchFailureNotice = {
  /** The uppercase label. Each notice "names its cause". */
  label: string;
  title: string;
  body: string;
  /** The filled action. Every one of the three ends in a filed piece. */
  primary: string;
  /** The peer beside it, where the cause has a second real answer. */
  secondary: string | null;
};

/**
 * The atlas's own words. Held as data rather than inline JSX so the copy can be
 * asserted against the frame without rendering a screen.
 */
export const SEARCH_FAILURE_NOTICES: Record<SearchFailureCause, SearchFailureNotice> = {
  offline: {
    label: 'Offline',
    title: 'No connection, so no search',
    body: 'Your words are kept on this phone. File the piece now and Cinch will look for a match next time it is online.',
    primary: 'File it in my words',
    secondary: null,
  },
  consent_declined: {
    label: 'Consent declined',
    title: 'Reading descriptions needs your say-so',
    body: 'You have kept processing off, so Cinch will not send this text anywhere. Typing the details yourself works without it.',
    // Named for the act rather than for the filing, because the sentence above
    // has just said that typing it yourself is what works here.
    primary: 'Fill it in myself',
    secondary: 'Review consent',
  },
  partner_unavailable: {
    label: 'Partner unavailable',
    title: 'The listing partner is not answering',
    body: 'Nothing about your closet depends on it. Try again in a moment, or file the piece in your own words now.',
    // The one notice whose primary is not the filing: a partner that is not
    // answering may answer in a moment, and offering the retry first is the
    // honest order. Filing is still right there beside it.
    primary: 'Try again',
    secondary: 'File it in my words',
  },
};

/** The server codes that mean the listing partner, specifically. */
const PARTNER_CODES = new Set(['search_failed', 'search_disabled']);

export type SearchFailureInput = {
  /** `GarmentSearchError.code`, when the last attempt produced one. */
  errorCode: string | null;
  online: boolean;
  /**
   * The local decline flag. NO LONGER READ by the classification — search does
   * not need consent since Packet 1. Kept on the input so the two call sites
   * and their test do not have to change shape, and so that deleting it is a
   * deliberate act rather than a silent one if the spoken path ever needs it
   * back here.
   */
  consentDeclined: boolean;
};

/**
 * Which notice, if any. `null` means no DS-05 notice applies and the sheet's
 * existing sentence stands.
 *
 * ORDER IS A DECISION, not a formality:
 *
 * · Consent no longer produces a notice at all — see the note above
 *   `SearchFailureCause`. Search does not need it, so a declined consent is not
 *   a reason a search did not happen, and saying it was would be blaming the
 *   user's choice for something their choice does not do.
 * · Offline outranks a partner failure, because a request that never left the
 *   phone tells us nothing about whether the partner is answering. A search
 *   attempted with no signal fails with a transport error, and reading that as
 *   "the partner is down" would blame a third party for the user's tunnel.
 * · Everything else is left alone. A spent quota, a plan boundary, a full
 *   closet and a rejected link are not DS-05 causes; each already has its own
 *   true sentence, and folding them into "the partner is not answering" would
 *   replace four accurate messages with one false one.
 */
export function classifySearchFailure({
  errorCode,
  online,
}: SearchFailureInput): SearchFailureCause | null {
  if (!online) return 'offline';
  if (errorCode !== null && PARTNER_CODES.has(errorCode)) return 'partner_unavailable';
  return null;
}
