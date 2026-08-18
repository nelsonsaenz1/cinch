/**
 * The stylist's analytics allowlist — ten events, and nothing else.
 *
 * A `.ts` with no import of `@/lib/posthog`, on the convention this wave set:
 * that module pulls in expo-updates and the PostHog SDK and cannot be executed
 * by the node suite, while the PROPERTY SHAPES are the part worth testing.
 *
 * ── WHAT MAY NEVER BE SENT ──────────────────────────────────────────────────
 *
 * A prompt or any free text, a transcript, response text, an item or outfit id,
 * a garment name, an image URL or path, a price, history content, friend data,
 * user identity, or a location.
 *
 * The first is the one this screen exists to protect. A stylist prompt is
 * somebody describing their own life in their own words — a funeral, an
 * interview, a first date — and it is the single most sensitive string this app
 * ever holds. It is answered on the device or sent to one bounded model
 * boundary, and it reaches a warehouse under no circumstances at all.
 */

/** The ten names, mirrored locally so the union membership is checkable. */
export const STYLIST_EVENTS = {
  opened: 'stylist_opened',
  doorTapped: 'door_tapped',
  questionnaireStep: 'questionnaire_step',
  chatSent: 'chat_sent',
  chatReplyOk: 'chat_reply_ok',
  chatError: 'chat_error',
  localFactAnswered: 'local_fact_answered',
  platesShown: 'plates_shown',
  plateTapped: 'plate_tapped',
  allowanceMarkShown: 'allowance_mark_shown',
} as const;

/** Which of the four doors, by POSITION. Never its label, never its intent text. */
export type DoorIndex = 1 | 2 | 3 | 4;

/** How far into the questionnaire. A step number, never an answer. */
export type StepNumber = 1 | 2 | 3 | 4;

/**
 * Why a turn failed.
 *
 * Four bounded causes with four different remedies — and never the server's
 * message, which is free text that one day carries a row id.
 */
export type ChatErrorCause = 'plan_excluded' | 'quota' | 'transport' | 'consent';

/**
 * How many plates were drawn.
 *
 * A small bounded integer — at most a handful — and it describes the REPLY
 * rather than the closet. It is not a wardrobe size and cannot be used as one.
 */
export type PlateCount = 0 | 1 | 2 | 3;

export type StylistProps = Record<string, string | number | boolean>;

export const openedProps = (): StylistProps => ({});

export const doorTappedProps = (index: DoorIndex): StylistProps => ({ index });

export const questionnaireStepProps = (step: StepNumber): StylistProps => ({ step });

/** THAT a question was sent. Never the question. */
export const chatSentProps = (): StylistProps => ({});

/** THAT a reply landed. Never the reply. */
export const chatReplyOkProps = (): StylistProps => ({});

export const chatErrorProps = (cause: ChatErrorCause): StylistProps => ({ cause });

/** THAT a question was answered on the device — which spends nothing. */
export const localFactAnsweredProps = (): StylistProps => ({});

export const platesShownProps = (count: PlateCount): StylistProps => ({ count });

/** THAT a plate was opened. Never which garment. */
export const plateTappedProps = (): StylistProps => ({});

export const allowanceMarkShownProps = (shown: boolean): StylistProps => ({ shown });

/** Exported so the privacy test can walk every legal value rather than a sample. */
export const DOOR_INDICES: readonly DoorIndex[] = [1, 2, 3, 4];
export const STEP_NUMBERS: readonly StepNumber[] = [1, 2, 3, 4];
export const CHAT_ERROR_CAUSES: readonly ChatErrorCause[] = [
  'plan_excluded',
  'quota',
  'transport',
  'consent',
];
export const PLATE_COUNTS: readonly PlateCount[] = [0, 1, 2, 3];
