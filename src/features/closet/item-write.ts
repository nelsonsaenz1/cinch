import type { Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemUpdate = Database['public']['Tables']['items']['Update'];

/**
 * The fields an edit anywhere in the app is allowed to correct.
 *
 * One list rather than three: the review deck, item detail's edit sheet and the
 * local item's manual editor all write through `useVerifyItem`, and a column
 * that only one of them can reach would be a difference nobody designed.
 */
export type ItemPatch = Partial<
  Pick<
    Item,
    | 'category'
    | 'subcategory'
    | 'occasions'
    | 'seasons'
    | 'purchasePrice'
    // The manual-tagging pair — a local item's colours are hand-picked and its
    // fabric hand-chosen, written to the same columns the tagger fills.
    | 'colors'
    | 'material'
  >
>;

/**
 * The camelCase patch, as the `items` row the write actually sends.
 *
 * Pulled out of the mutation so the decision — which fields travel, and what
 * `undefined` means as against `null` — can be read and tested without a
 * network client, a query cache or a signed-in session. `undefined` is "the
 * caller said nothing about this field"; `null` is a real value the caller
 * chose ("I don't know what this cost", "no fabric"), and the difference is
 * why every test below is `!== undefined` rather than truthiness.
 */
export function buildItemUpdate({
  patch,
  verify,
}: {
  patch?: ItemPatch;
  /** Whether this write also means "a human confirmed the tags". */
  verify: boolean;
}): ItemUpdate {
  const update: ItemUpdate = verify ? { user_verified: true, status: 'verified' } : {};

  if (patch?.category !== undefined) update.category = patch.category;
  if (patch?.subcategory !== undefined) update.subcategory = patch.subcategory;
  if (patch?.occasions !== undefined) update.occasions = patch.occasions;
  if (patch?.seasons !== undefined) update.seasons = patch.seasons;
  if (patch?.purchasePrice !== undefined) update.purchase_price = patch.purchasePrice;
  // The `colors` column is jsonb and the generated type says only `Json`; the
  // app's `[{name, hex?}]` is a valid shape of it, the same one `tag-item`
  // writes, so the cast records intent rather than papering over a mismatch.
  if (patch?.colors !== undefined) update.colors = patch.colors as ItemUpdate['colors'];
  if (patch?.material !== undefined) update.material = patch.material;

  return update;
}

/** Nothing to say — a `verify: false` call whose patch turned out to be empty. */
export function isEmptyUpdate(update: ItemUpdate): boolean {
  return Object.keys(update).length === 0;
}

/**
 * What a save that changed nothing is called.
 *
 * ── Why an update needs a receipt ─────────────────────────────────────────
 *
 * `items: owner can update` (migrations/20260803154431:131) scopes USING and
 * WITH CHECK to `auth.uid() = user_id`. A row the policy hides — a stale or
 * refreshed session, an id from another account's cache — matches nothing, and
 * PostgREST answers **200 with zero rows and `error: null`**. An `update()`
 * that does not select back therefore cannot tell "the column now says
 * Bottoms" from "nothing on the server has ever heard of this edit".
 *
 * That is not a hypothetical: the 2026-08-31 funnel run lost a category change
 * exactly this way. The sheet closed, the queries were invalidated, an
 * `item_tag_corrected` event was recorded, and the row still said `top` — the
 * app had no way to know, so the correction had to be made by hand in the
 * database. `useUnverifyItem` had already learned this lesson and selects its
 * rows back; every write in this file now does the same.
 */
export const ITEM_WRITE_LOST = 'Cinch couldn’t save that change. Try again.';

/** Zero rows back is the failure it looks like, never a quiet success. */
export function assertItemWriteLanded(rows: { id: string }[] | null | undefined): void {
  if (!rows?.length) throw new Error(ITEM_WRITE_LOST);
}

/** What PostgREST hands back from an `update(...).select('id')`. */
export type ItemWriteResult = {
  data: { id: string }[] | null;
  error: { message: string } | null;
};

/**
 * Run one item update and insist on its receipt.
 *
 * The query itself is the caller's — it owns the scoping (`id` AND `user_id`,
 * so a row belonging to someone else is a miss rather than a policy rejection)
 * and the `select('id')` that makes a receipt exist at all. What lives here is
 * the reading of the answer, which is the part that was wrong: an error is a
 * failure, and so is a success that changed nothing.
 */
export async function commitItemUpdate(
  run: () => PromiseLike<ItemWriteResult>,
): Promise<{ id: string }[]> {
  const { data, error } = await run();
  if (error) throw error instanceof Error ? error : new Error(error.message);
  assertItemWriteLanded(data);
  return data as { id: string }[];
}
