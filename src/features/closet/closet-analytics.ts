/**
 * The closet's analytics allowlist — six events, and nothing else.
 *
 * A `.ts` with no import of `@/lib/posthog`, on the convention this wave set:
 * that module pulls in expo-updates and the PostHog SDK and cannot be executed
 * by the node suite, while the PROPERTY SHAPES are the part worth testing,
 * because they are where content would leak in.
 *
 * ── WHAT MAY NEVER BE SENT ──────────────────────────────────────────────────
 *
 * An item id, a user id, an item NAME, a category as free text, SEARCH TEXT,
 * an image path or URL, a COUNT OF OWNED PIECES, a plan price, or any content
 * at all. `tests/closet-analytics.test.ts` asserts this against every builder
 * across every legal input rather than against a copy of this paragraph.
 *
 * Two of those deserve saying twice. SEARCH TEXT is the sharpest: somebody
 * typing "interview" or a brand name into their own closet is telling this app
 * something about their life, and none of it belongs on a server. And the
 * COUNT OF OWNED PIECES is the quiet one — a wardrobe size is a wealth proxy
 * and a near-unique number, which is why `closet_selection` reports which of
 * three buckets a selection fell into and never how many things somebody owns.
 */

/** The six names, mirrored locally so the union membership is checkable. */
export const CLOSET_EVENTS = {
  viewed: 'closet_viewed',
  filter: 'closet_filter',
  selection: 'closet_selection',
  bulk: 'closet_bulk',
  capacityState: 'closet_capacity_state',
  plansDoor: 'closet_plans_door_opened',
} as const;

export type RailsValue = 'none' | 'worn' | 'outfits' | 'both';
export type FilterValue = 'category' | 'search' | 'both';
export type SelectionValue = 'one' | 'many' | 'all';
export type BulkActionValue = 'recategorise' | 'store' | 'restore' | 'delete';
export type BulkResultValue = 'ok' | 'failed';
export type CapacityValue = 'room' | 'active_full' | 'total_full';

export type ClosetProps = Record<string, string | number | boolean>;

/** WHICH rails were on screen — never what was in them, never how many. */
export const closetViewedProps = (rails: RailsValue): ClosetProps => ({ rails });

/**
 * WHICH KINDS of filter were active. Never the category as text and never, in
 * any circumstance, the query.
 */
export const closetFilterProps = (kind: FilterValue): ClosetProps => ({ kind });

/** One, many, or all — never the number, which is a wardrobe size. */
export const closetSelectionProps = (size: SelectionValue): ClosetProps => ({ size });

/** What was attempted and whether it landed. Never to what. */
export const closetBulkProps = (
  action: BulkActionValue,
  result: BulkResultValue,
): ClosetProps => ({ action, result });

/** Which of three walls — never the ceiling, never the usage. */
export const closetCapacityProps = (state: CapacityValue): ClosetProps => ({ state });

/** The plans door was opened. Nothing about the plan, and no price. */
export const closetPlansDoorProps = (): ClosetProps => ({});

/** Exported so the privacy test can walk every legal value rather than a sample. */
export const RAILS_VALUES: readonly RailsValue[] = ['none', 'worn', 'outfits', 'both'];
export const FILTER_VALUES: readonly FilterValue[] = ['category', 'search', 'both'];
export const SELECTION_VALUES: readonly SelectionValue[] = ['one', 'many', 'all'];
export const BULK_ACTIONS: readonly BulkActionValue[] = [
  'recategorise',
  'store',
  'restore',
  'delete',
];
export const BULK_RESULTS: readonly BulkResultValue[] = ['ok', 'failed'];
export const CAPACITY_VALUES: readonly CapacityValue[] = ['room', 'active_full', 'total_full'];
