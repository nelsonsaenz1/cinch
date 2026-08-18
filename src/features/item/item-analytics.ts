/**
 * Item detail's analytics allowlist — eight events, and nothing else.
 *
 * A `.ts` with no import of `@/lib/posthog`, on the convention this wave set:
 * that module pulls in expo-updates and the PostHog SDK and cannot be executed
 * by the node suite, while the PROPERTY SHAPES are the part worth testing.
 *
 * ── WHAT MAY NEVER BE SENT ──────────────────────────────────────────────────
 *
 * An item id, an item NAME, a brand, THE PRICE VALUE, an image path or URL,
 * tags, colours, A WEAR COUNT, free text, or a friend's identity.
 *
 * Three of those are the sharp ones. THE PRICE is what somebody paid for a
 * coat, which is income data by another name. THE WEAR COUNT is a behavioural
 * fingerprint and, joined with a timestamp, near-unique. And FRIEND IDENTITY
 * is the whole reason lending reports a boolean: who may borrow a piece is a
 * fact about two people, and only one of them is here.
 */

/** The eight names, mirrored locally so the union membership is checkable. */
export const ITEM_EVENTS = {
  viewed: 'item_detail_viewed',
  priceAdded: 'price_added',
  lendingSet: 'lending_set',
  maintenance: 'maintenance_action',
  listingPhotoRemoved: 'listing_photo_removed',
  stored: 'item_stored',
  deleted: 'item_deleted',
  actionFailed: 'action_failed',
} as const;

/** Which maintenance door was used. Never what it did to which piece. */
export type MaintenanceAction = 'retag' | 'send_back' | 'view_original';

/**
 * Why something did not land.
 *
 * A bounded CAUSE, never the server's message. A raw error string is free text
 * with an unbounded shape, and the one time it carries a row id nobody notices
 * until it is in a warehouse.
 */
export type FailureCause = 'network' | 'rejected' | 'signed_out' | 'unexpected';

export type ItemProps = Record<string, string | boolean>;

/** The visit. Nothing about the piece — not even whether it has a price. */
export const itemViewedProps = (): ItemProps => ({});

/** WHETHER a price was added. Never the number. */
export const priceAddedProps = (added: boolean): ItemProps => ({ added });

/** WHETHER lending was turned on. Never for whom, and never to whom. */
export const lendingSetProps = (on: boolean): ItemProps => ({ on });

export const maintenanceProps = (action: MaintenanceAction): ItemProps => ({ action });

export const listingPhotoRemovedProps = (removed: boolean): ItemProps => ({ removed });

/** WHETHER it landed — the same shape for both destructive actions. */
export const storedProps = (ok: boolean): ItemProps => ({ ok });
export const deletedProps = (ok: boolean): ItemProps => ({ ok });

export const actionFailedProps = (cause: FailureCause): ItemProps => ({ cause });

/** Exported so the privacy test can walk every legal value rather than a sample. */
export const MAINTENANCE_ACTIONS: readonly MaintenanceAction[] = [
  'retag',
  'send_back',
  'view_original',
];

export const FAILURE_CAUSES: readonly FailureCause[] = [
  'network',
  'rejected',
  'signed_out',
  'unexpected',
];
