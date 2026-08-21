/**
 * §3 of the handoff, verbatim, in one file.
 *
 * Two reasons it is a module and not a set of string literals in the screens.
 *
 * The privacy sentences are CLAIMS. "It is not a web search and it is not sent
 * to an AI model" is a statement about what the server does, and the only thing
 * that keeps it true is that changing the server breaks a test that reads this
 * constant. `tests/catalogue-copy.test.ts` holds the banned-word list from §3
 * against every string here, and `tests/catalogue-fail-closed.test.ts` (Packet
 * 1) already imports the equivalent server-side disclosure for the same reason.
 *
 * And the banned words are checkable only if the copy is enumerable. §3 ends
 * with a list of ten words that "appear nowhere" — price, buy, shop now, cart,
 * sponsored, paid link, affiliate, commission, in stock, web search. A screen
 * that builds a sentence inline is a screen the test cannot read.
 */

/** CPV2-01. The helper line under the route name, above the field. */
export const FIELD_HELP =
  'Name a piece you own — brand, kind, colour if you know it. Cinch looks it up in a licensed shop catalogue and shows you the photographs.';

/** CPV2-01. The field's own label, and its placeholder. */
export const FIELD_LABEL = 'What is it?';

/** CPV2-01, CPV2-03. The one forward action, before and after a transcript. */
export const FIND_ACTION = 'Find its photo';
export const SEARCH_AGAIN_ACTION = 'Search again';

/** CPV2-02. Said above the meter while the microphone is open. */
export const VOICE_PROMPT = 'Say what it is';
export const VOICE_PROMPT_HELP = 'One piece, in a few words. Brand and kind are enough.';

/** CPV2-03. The transcript, quoted back, so the screen never shows two queries. */
export function heardLine(transcript: string): string {
  return `Heard: ${transcript}`;
}

/** CPV2-03. */
export const TRANSCRIPT_EDIT_HELP = 'Edit the words if that is not quite it.';

/** CPV2-V02. The extracted words, with the utterance quoted beneath them. */
export const FROM_YOUR_WORDS = 'From your words';
export function saidLine(utterance: string): string {
  return `You said "${utterance}". Cinch searches the garment words and keeps your colours ready to select.`;
}

/** CPV2-V02. The tray heading over the held-walkthrough sentence. */
export const HELD_WALKTHROUGH_HEADING = 'Your walkthrough is held';

/** CPV2-V02's own privacy line — the recording is already gone by then. */
export const WALKTHROUGH_PRIVACY =
  'These words go to Cinch and the licensed shop catalogue. The recording from the walkthrough was already deleted.';

/** CPV2-01, CPV2-V02. The typed-path privacy line. */
export const TYPED_PRIVACY =
  'What you type goes to Cinch and to the licensed shop catalogue so it can be matched. It is not a web search and it is not sent to an AI model.';

/** CPV2-02. Said while the microphone is live. */
export const VOICE_DISCLOSURE =
  "Your voice is turned into words by Cinch's voice processor, then the recording is deleted. Only the words are used to search the shop catalogue.";

/** CPV2-03. Said once the transcript is in the field. */
export const AFTER_TRANSCRIPTION =
  'The recording is already deleted. Only these words are searched.';

/** The category grid's heading, under the field. A peer door, not a fallback. */
export const BROWSE_HEADING = 'Or browse a category';

/** Said under the heading, once. The privacy claim is structural — a tile
 *  sends a category, so there are no typed words anywhere in the request. */
export const BROWSE_HELP =
  'Tap a category to see pieces from the licensed shop catalogue. Nothing is typed and nothing is searched on the web.';

/** A category the catalogue answered with nothing. The whole answer, like
 *  `NO_MATCH` — never drawn over a failure, which has its own notices. */
export const BROWSE_EMPTY =
  'The licensed shop catalogue has nothing to show here right now.';

/** The browsed grid's near-miss heading. `NEAR_MISS_HEADING` names the typed
 *  query's own garment ("Not a T-shirt, but close") and a tapped category has
 *  no such word to put in the sentence, so it gets a generic one. */
export const BROWSE_NEAR_MISS_HEADING = 'Close, not exact';

/** The way back from a browsed grid to the nine tiles. */
export const BROWSE_BACK_ACTION = 'All categories';

/** The failed browse's own retry. */
export const BROWSE_RETRY_ACTION = 'Try this category again';

/** CPV2-04 card. */
export const PROVENANCE_SHORT = 'Photos from the shop catalogue.';

/** CPV2-05 detail. */
export const PROVENANCE_LONG =
  'Photograph and details come from the licensed shop catalogue. Cinch files it as a piece you own.';

/** CPV2-04. The subordinate group's heading. */
export const NEAR_MISS_HEADING = 'Not a T-shirt, but close';

/** CPV2-05. Said above the action, before anything is written. */
export const PRE_WRITE_REASSURANCE = 'You will see the pieces before anything is added.';

/** CPV2-08. Why three pieces are one family. */
export const FAMILY_EXPLANATION =
  'All three came from one product family, so Cinch treats them as the same shirt in three colours when it plans a look.';

/** CPV2-09. The whole answer, and it says so. */
export const NO_MATCH =
  'The licensed shop catalogue has no James Perse tee right now. Cinch does not search the open web, so this is the whole answer.';

/** CPV2-V01. The walkthrough's quiet ask. */
export const WALKTHROUGH_ACTION = 'Find its product photo';
export const WALKTHROUGH_EXPLANATION =
  'Looks up this one piece in the licensed shop catalogue. The rest of your list is not searched.';

/** CPV2-V02. What the walkthrough promises while you are away from it. */
export const HELD_WALKTHROUGH =
  'Two pieces confirmed, four still to review. Whatever happens here, you come back to piece three with the same words and the same progress.';

/**
 * §10.3 — "Where no usable name exists the row must say so, not invent one."
 *
 * The live feed's Grailed rows are resale keyword dumps ("James Perse T-Shirt
 * Mens 1XL Gray Cotton Casual Usa Made Logo Classic Preppy Short Sleeve"). The
 * server's `displayTitle` strips the variant axes off the end and stops, which
 * is correct — inventing a shorter name would be inventing a product. When what
 * survives is still not a name, the card says this instead of printing junk.
 */
export const TITLE_UNAVAILABLE = 'Catalogue name unavailable';

/** §6. The pictureless colourway announces its own absence. */
export const NO_PHOTO = 'No photo in the catalogue';

/**
 * A photograph that exists and did not arrive.
 *
 * NOT `NO_PHOTO`. The catalogue has this picture; the device could not fetch
 * it, and saying "No photo in the catalogue" over a merchant URL that returned
 * a 403 would be telling the user something false about the shop's listing.
 * The distinction also survives into what the person does next: an absent photo
 * is permanent, a failed one comes back on the next visit.
 */
export const PHOTO_FAILED = 'Photo did not load';

/**
 * The import was refused for consent, and the ask was declined.
 *
 * Never the generic failure sentence: "try again in a moment" would be false —
 * time fixes nothing here. Imported pieces go through the same AI tagging a
 * photographed one does, which is why the server's consent gate covers them,
 * and the sentence says which switch is the one that decides.
 */
export const IMPORT_CONSENT_DECLINED =
  'Nothing was added. Filing a catalogue photo uses AI processing, which is off for your account.';

/**
 * The ten words that appear nowhere in this feature, from the end of §3.
 *
 * Exported so the test does not restate them — a banned list the test owns its
 * own copy of is a list that drifts from the one the design wrote down.
 */
export const BANNED_WORDS: readonly string[] = [
  'price',
  'buy',
  'shop now',
  'cart',
  'sponsored',
  'paid link',
  'affiliate',
  'commission',
  'in stock',
  'web search',
];

/**
 * Every sentence this feature can say, for the banned-word test to walk.
 *
 * `NO_MATCH` and `TYPED_PRIVACY` both contain "shop", and `NO_MATCH` contains
 * "search" — neither is banned. The banned entries are phrases, and the test
 * matches them as phrases, which is why "shop catalogue" and "does not search
 * the open web" survive while "shop now" and "web search" would not.
 */
export const ALL_COPY: readonly string[] = [
  FIELD_HELP,
  FIELD_LABEL,
  FIND_ACTION,
  SEARCH_AGAIN_ACTION,
  VOICE_PROMPT,
  VOICE_PROMPT_HELP,
  TRANSCRIPT_EDIT_HELP,
  FROM_YOUR_WORDS,
  HELD_WALKTHROUGH_HEADING,
  WALKTHROUGH_PRIVACY,
  TYPED_PRIVACY,
  VOICE_DISCLOSURE,
  AFTER_TRANSCRIPTION,
  BROWSE_HEADING,
  BROWSE_HELP,
  BROWSE_EMPTY,
  BROWSE_NEAR_MISS_HEADING,
  BROWSE_BACK_ACTION,
  BROWSE_RETRY_ACTION,
  PROVENANCE_SHORT,
  PROVENANCE_LONG,
  NEAR_MISS_HEADING,
  PRE_WRITE_REASSURANCE,
  FAMILY_EXPLANATION,
  NO_MATCH,
  WALKTHROUGH_ACTION,
  WALKTHROUGH_EXPLANATION,
  HELD_WALKTHROUGH,
  TITLE_UNAVAILABLE,
  NO_PHOTO,
  PHOTO_FAILED,
  IMPORT_CONSENT_DECLINED,
];
