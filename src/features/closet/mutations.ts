import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  buildItemUpdate,
  commitItemUpdate,
  isEmptyUpdate,
  type ItemPatch,
} from '@/features/closet/item-write';
import { withDeadline } from '@/features/closet/session';
import { deleteLocalPhoto } from '@/features/ingest/local-photos';
import { track } from '@/lib/posthog';
import { getUserId, supabase } from '@/lib/supabase';
import type { Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemUpdate = Database['public']['Tables']['items']['Update'];

/** The garment bucket. Objects are keyed `{user_id}/{item_id}/{file}`. */
const BUCKET = 'garments';

/**
 * How long the auth lookup behind a destructive write may pend before it fails
 * honestly. `getUserId` calls `getClaims()`, which on Hermes round-trips to the
 * auth server and can pend forever when auth-js's internals stall — see
 * features/closet/session.ts. A "Remove" that spins indefinitely is the same
 * bug that file exists to prevent, so the deadline applies here too.
 */
const AUTH_DEADLINE_MS = 8_000;

/**
 * Invalidate everything that counts garments.
 *
 * The same four keys `upload-queue.invalidateAfterItemSettled` touches when an
 * item lands — removal moves every one of those numbers in the other
 * direction — plus the postable-outfit list, because an outfit can lose its
 * last surviving piece to a removal and stops being postable at all.
 */
function invalidateAfterItemsRemoved(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['closet'] });
  void qc.invalidateQueries({ queryKey: ['wardrobe'] });
  void qc.invalidateQueries({ queryKey: ['review-queue'] });
  void qc.invalidateQueries({ queryKey: ['closet-count'] });
  void qc.invalidateQueries({ queryKey: ['my-postable-outfits'] });
}

/**
 * The one write from the review deck — and now the one write from item detail.
 *
 * Every accepted or edited item flips `user_verified = true` — that's the
 * signal downstream: the outfit engine trusts verified tags more, and the
 * review queue query filters on it. Corrections (patch fields) go in the same
 * write to avoid a two-round-trip flicker.
 */
export function useVerifyItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      patch,
      verify = true,
    }: {
      id: string;
      /**
       * The correctable fields. The list and the camelCase → column mapping
       * live in `features/closet/item-write.ts`, so what a save actually sends
       * can be read — and tested — without a client, a cache or a session.
       */
      patch?: ItemPatch;
      /**
       * Whether this write also means "a human confirmed the tags".
       *
       * True for the review deck, which is exactly that act. False for an edit
       * made anywhere else — typing in what a garment cost says nothing about
       * whether the tagger got its colours right, and claiming otherwise would
       * quietly promote an unreviewed item and remove it from the queue the
       * user never saw it in.
       */
      verify?: boolean;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const update = buildItemUpdate({ patch, verify });

      // Nothing to say. A `verify: false` call whose patch turned out to be
      // empty is a no-op, not an empty UPDATE for PostgREST to reject.
      if (isEmptyUpdate(update)) return { id };

      /**
       * SCOPED AND READ BACK, for the reason `useUnverifyItem` already gives.
       *
       * The owner policy scopes UPDATE to `auth.uid() = user_id`, so a row this
       * session cannot see matches nothing and PostgREST answers 200 with zero
       * rows and no error. This used to send `.eq('id', id)` alone and inspect
       * only `error` — which meant a correction that changed nothing closed the
       * sheet, invalidated the queries and recorded an `item_tag_corrected`
       * event, indistinguishable from one that landed. The 2026-08-31 funnel
       * run lost a category change that way and it had to be repaired by hand.
       *
       * `user_id` joins the filter so the miss is honest arithmetic rather than
       * a policy rejection, and `select('id')` is the receipt.
       */
      await commitItemUpdate(() =>
        supabase.from('items').update(update).eq('id', id).eq('user_id', userId).select('id'),
      );

      /**
       * The correction rate — the number the tagger is actually judged on.
       *
       * An accuracy figure measured against fixtures says how the model does on
       * photographs somebody chose. This says how it does on the ones people
       * take, and it is the only signal of that kind the app has: a patch here
       * is a human disagreeing with a machine about a specific field.
       *
       * FIELD NAMES ONLY. Not the values — a corrected brand or colour is the
       * user's own text about their own possessions, and it has no business in
       * an analytics property. `verified` separates the review deck (where a
       * correction is the model being wrong) from a later edit in item detail
       * (where it is just as often the user changing their mind).
       */
      const corrected = Object.keys(patch ?? {});
      // Sorted and joined: a property value has to be a scalar, and a stable
      // order means `category,colors` is one bucket rather than two.
      if (corrected.length) {
        track('item_tag_corrected', { fields: corrected.sort().join(','), verified: verify });
      }

      // TODO(OUT-22): if `patch` was set, log a row to `style_feedback` for the
      // personalization flywheel — the model was wrong in a specific direction
      // and that's the signal we want to distill.
      return { id };
    },
    onSuccess: () => {
      // The user just changed both queues. Invalidate rather than optimistic-
      // update: the swipe deck sequencing is easier to reason about when the
      // list is the source of truth.
      void qc.invalidateQueries({ queryKey: ['review-queue'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Unverify — the one reverse transition
// ---------------------------------------------------------------------------

/**
 * Put a confirmed garment back in the review deck.
 *
 * ── The status machine, as the migrations and the pipeline actually write it ──
 *
 * `item_status` (migrations/20260803154431:20) is five values, and the column
 * defaults to `pending_upload` (:82). No trigger touches it: the only two on
 * `items` are `items_set_updated_at` (:329) and `items_enforce_limit`
 * (migrations/20260805160000:283, a BEFORE INSERT count), neither of which
 * reads or writes `status`. So every transition below is an explicit write:
 *
 *   pending_upload → pending_tag → tagged ──────┐
 *   (row inserted)   (media up)   (tagger won)  ├→ verified  (a human confirmed)
 *                                 needs_review ─┘  (tagging failed, still usable)
 *
 * `upload-queue` writes `pending_upload` then `pending_tag` (and the
 * `garment-search` function does the same two server-side); `tag-item` writes
 * `tagged` on success and `needs_review` on failure; the client writes
 * `verified` (`useVerifyItem` above) and `pending_tag` (`useRetagItem` below,
 * which clears `user_verified` with it). Nothing else moves the column.
 *
 * ── Why clearing the flag is not enough ───────────────────────────────────
 *
 * The deck and its count both read `user_verified = false AND status in
 * ('tagged', 'needs_review')` (features/closet/queries.ts). `verified` is
 * therefore not a sixth state layered on top — it is the *erasure* of which of
 * the two the row was in. Writing `user_verified = false` alone would leave the
 * row at `verified`, outside the `in` filter, and the piece would be neither
 * confirmed nor reviewable. This takes the whole item rather than an id
 * precisely because the caller is the only one still holding that record.
 *
 * `needs_review` is restored only for a row that was in it. `sweepPendingTags`
 * (features/ingest/upload-queue.ts) re-requests tagging for every `pending_tag`
 * and `needs_review` row on launch, so writing it speculatively would book a
 * billed re-read nobody asked for. An already-`verified` row arriving here —
 * item detail, where the pre-confirm status is long gone — lands on `tagged`,
 * which is also the truer claim: its tags exist and a person signed off on them
 * once. Asking for fresh tags is `useRetagItem`, and it is a different sentence.
 *
 * The confirm's corrections are deliberately NOT rolled back. `useVerifyItem`
 * sends the patch and the flag in one update, but the patch is the user's own
 * typing rather than the machine's guess, and discarding "this coat cost £240"
 * because they also undid the confirm would throw away the only part of that
 * write they authored. The piece goes back to the deck with their corrections
 * on it.
 *
 * RLS: `items: owner can update` (migrations/20260803154431:131) scopes USING
 * and WITH CHECK to `auth.uid() = user_id`, so a row that is not the caller's
 * matches nothing and PostgREST answers 200 with zero rows. The update selects
 * back what it changed and treats an empty result as the failure it is — an
 * undo that silently changed nothing must not be reported as an undo.
 */
export function useUnverifyItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ item }: { item: Item }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const update: ItemUpdate = {
        user_verified: false,
        status: item.status === 'needs_review' ? 'needs_review' : 'tagged',
      };

      const { data, error } = await supabase
        .from('items')
        .update(update)
        .eq('id', item.id)
        .eq('user_id', userId)
        .select('id');

      if (error) throw error;
      if (!data?.length) throw new Error('Cinch couldn’t put that piece back in the deck.');

      return { id: item.id, status: update.status };
    },
    onSuccess: () => {
      // Same pair `useVerifyItem` invalidates, for the same reason in reverse:
      // the deck re-reads and the piece reappears in its queue order rather
      // than being spliced back in at a position the server never agreed to.
      void qc.invalidateQueries({ queryKey: ['review-queue'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Removal
// ---------------------------------------------------------------------------

/**
 * Every storage object that belongs to one item.
 *
 * Two sources, deliberately unioned. The row's four path columns are the
 * authoritative record of what the app wrote, and the folder listing catches
 * what the columns cannot name: `upload-queue` uploads `original.jpg`,
 * `thumb.jpg`, `cutout.png` and `plate.png` BEFORE it writes those columns, so
 * an import killed between the two leaves objects on a row whose paths are all
 * null.
 *
 * Listing alone is not enough either: a listing that fails for network reasons
 * reports the same empty array as a folder that is genuinely empty, and
 * treating that as "no photos to delete" is precisely the promise this
 * function must not break. So the two sources cover each other, and the one
 * case where they cannot — a row naming no paths at all, where the listing is
 * the only witness there is — makes a failed listing fatal rather than
 * silently deleting the row and orphaning objects nobody can name again.
 */
async function garmentObjects(
  userId: string,
  row: {
    id: string;
    image_path: string | null;
    cutout_path: string | null;
    thumb_path: string | null;
    plate_path: string | null;
  },
): Promise<string[]> {
  const paths = new Set<string>();

  for (const p of [row.image_path, row.cutout_path, row.thumb_path, row.plate_path]) {
    if (p) paths.add(p);
  }

  const prefix = `${userId}/${row.id}`;
  const { data: listed, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });

  if (error && paths.size === 0) {
    throw new Error(`Couldn’t check this piece’s photos, so nothing was removed. ${error.message}`);
  }

  for (const object of listed ?? []) paths.add(`${prefix}/${object.name}`);

  return [...paths];
}

/**
 * Remove garments from the closet, for good.
 *
 * ── Why this is a hard DELETE and not the archive flag ────────────────────
 *
 * `is_archived` exists and every closet read filters it, so archiving looks
 * like the gentler answer. It isn't, for two reasons that only show up in the
 * schema:
 *
 * 1. **Archived rows spend the ACCOUNT allowance, not the closet one.** This
 *    said "still spend the closet allowance" until migration 20260808190100
 *    split the ceiling: the active limit now counts unarchived rows only, so
 *    storing frees a slot, while a larger total still stops "archive
 *    everything" becoming an unlimited free closet. The original objection
 *    stands for THIS function regardless — nothing here can unarchive, and a
 *    removal that costs the user capacity forever is not a removal, which is
 *    why Remove is a hard delete and storage is a separate, reversible act.
 *
 * 2. **The cascade does not destroy the history that matters.** The learning
 *    and accounting tables — `style_feedback`, `tag_corrections`, `ai_calls`,
 *    `wishlist_items` — are all `on delete set null`, so the personalization
 *    flywheel and the spend record survive the garment. `outfit_reactions`
 *    keeps a plain `uuid[]` with no foreign key at all, so reaction history is
 *    untouched. What cascades is `outfit_items`, `closet_likes`,
 *    `item_inquiries` and `borrow_requests` — join rows that are meaningless
 *    without the garment. And the visible outcome there is identical under
 *    either design: an outfit whose piece is archived already renders without
 *    it (`useWardrobe` filters archived, and `useMyPostableOutfits` drops
 *    outfits left with nothing to show), so archiving would degrade that
 *    outfit exactly as much while keeping the row.
 *
 * A tombstone row pointing at photographs that no longer exist is also the
 * less honest artefact of the two: the promise made in the confirm dialog is
 * that the piece is gone and its photographs are deleted, and a hard delete is
 * that sentence executed literally.
 *
 * ── Order of operations ───────────────────────────────────────────────────
 *
 * Storage first, then the row. The row is the only record of where the objects
 * live, so deleting it first and failing on storage would strand photographs
 * nobody can name — the one outcome the privacy promise cannot survive. This
 * way a storage failure aborts with everything still intact and retryable, and
 * the worst case (objects gone, row delete failed) is a visible item with a
 * missing picture that a second Remove finishes off.
 */
export function useRemoveItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      if (ids.length === 0) return { removed: 0 };

      const userId = await withDeadline(getUserId(), AUTH_DEADLINE_MS, 'Sign-in check');
      if (!userId) throw new Error('Not signed in.');

      // Read the paths off the rows rather than trusting what the grid happens
      // to hold: the cache can be a few minutes old, and a stale `cutout_path`
      // is a photograph left in the bucket.
      const { data: rows, error: readError } = await supabase
        .from('items')
        .select('id, image_path, cutout_path, thumb_path, plate_path')
        .in('id', ids);
      if (readError) throw readError;

      const objects = (
        await Promise.all((rows ?? []).map((row) => garmentObjects(userId, row)))
      ).flat();

      if (objects.length > 0) {
        const { error: storageError } = await supabase.storage.from(BUCKET).remove(objects);
        // Deliberately fatal. Reporting success here would be claiming the
        // photographs are deleted while they are still in the bucket.
        if (storageError) {
          throw new Error(
            `Couldn’t delete the photos, so nothing was removed. ${storageError.message}`,
          );
        }
      }

      const { error: deleteError } = await supabase.from('items').delete().in('id', ids);
      if (deleteError) throw deleteError;

      // Local mode's half of "deleting an item deletes both": any photo kept
      // on-device for these rows goes with them. Fire-and-forget by design —
      // `deleteLocalPhoto` is a silent no-op when there is nothing local, and
      // a cleanup hiccup must not fail a removal the server already made.
      for (const id of ids) {
        void deleteLocalPhoto(id).catch(() => {});
      }

      return { removed: ids.length };
    },
    onSuccess: () => invalidateAfterItemsRemoved(qc),
  });
}

// ---------------------------------------------------------------------------
// Re-tagging
// ---------------------------------------------------------------------------

/** The parts of `tag-item`'s response this screen reads. */
type TagResponseBody = {
  ok?: boolean;
  status?: string;
  error?: string;
  message?: string;
  period?: string;
};

/**
 * Status code and parsed body from a non-2xx invoke, as far as either can be
 * read. Mirrors `upload-queue`'s reader of the same name — that one is private
 * to the queue module and its `requestTag` cannot send `force`, so this path
 * invokes the function directly rather than coupling item detail to the import
 * queue's job store.
 */
async function readHttpError(
  error: unknown,
): Promise<{ status: number | null; body: TagResponseBody | null }> {
  if (!(error instanceof FunctionsHttpError)) return { status: null, body: null };
  const response = (error as { context?: unknown }).context as Response | undefined;
  if (!response) return { status: null, body: null };
  try {
    return { status: response.status, body: (await response.json()) as TagResponseBody };
  } catch {
    return { status: response.status, body: null };
  }
}

/**
 * What to tell the user when the server declines.
 *
 * The allowance is enforced server-side (`_shared/quota.ts`) and answers 402
 * when the plan excludes the workload and 429 when the period's allowance is
 * spent. Both are said plainly rather than dressed up as a generic failure —
 * the user asked for a specific thing, paid for or not, and deserves to know
 * which of the two it was.
 */
function refusalMessage(status: number | null, body: TagResponseBody | null): string {
  const detail = body?.error;

  if (status === 403 && detail === 'ai_consent_required') {
    // Also reached by a user whose consent predates a policy-version bump —
    // they never turned anything off, so this names the fix, not a state.
    return 'Reading this piece needs your OK on AI tagging — you can give it in Profile.';
  }
  if (status === 401 || status === 403) {
    return 'Cinch couldn’t verify your account. That one is on us — try again in a bit.';
  }
  if (status === 402) {
    return body?.message ?? 'Re-reading a piece is part of Standard and Pro.';
  }
  if (status === 429) {
    return `You’ve used this ${body?.period ?? 'period'}’s tagging allowance. It resets — try again then.`;
  }
  if (status === 409) {
    return 'Cinch is already reading this piece. Give it a moment.';
  }
  if (status === 404) {
    return 'Cinch couldn’t find this piece to read.';
  }
  if (status === 503) {
    return 'Tagging is unavailable right now. Try again shortly.';
  }
  return 'Cinch couldn’t re-read this piece. Try again.';
}

/**
 * Ask the tagger to look at this garment again.
 *
 * `tag-item` refuses a second call on a settled item unless `force` is set —
 * that idempotency gate is what stops the same photograph being billed twice —
 * so this is the one caller that sets it, because the user asked for exactly
 * that. `force` also releases the previous claim server-side, so a re-read is
 * not blocked by the run it is replacing.
 *
 * The row is flipped to `pending_tag` BEFORE the call rather than held in
 * component state: the invoke can take the better part of a minute (a vision
 * call with a fetched image), and a progress state that lives in one screen
 * disappears the moment the user navigates away, leaving the grid showing
 * confident old tags for a garment being re-read. Writing it means every
 * surface agrees, and `sweepPendingTags` is a safety net if the app dies
 * mid-call.
 *
 * `user_verified` goes back to false with it, and that is the honest part: the
 * tags about to land are the model's again, unread by anyone. The piece
 * returns to the review deck to be confirmed, which is where a freshly tagged
 * garment belongs.
 *
 * On a refusal the previous status and verification are put back, so a user
 * who is out of allowance is not left with an item stuck at "reading" forever.
 */
export function useRetagItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ item }: { item: Item }) => {
      const restore = async () => {
        await supabase
          .from('items')
          .update({ status: item.status, user_verified: item.userVerified })
          .eq('id', item.id);
      };

      const { error: markError } = await supabase
        .from('items')
        .update({ status: 'pending_tag', user_verified: false })
        .eq('id', item.id);
      if (markError) throw markError;

      // So the grid and the review queue show the in-progress state too, not
      // just the screen that asked for it.
      void qc.invalidateQueries({ queryKey: ['closet'] });
      void qc.invalidateQueries({ queryKey: ['review-queue'] });

      // `invoke` reports transport failures through `error` rather than by
      // throwing, but a throw here would skip the restore below and leave the
      // piece reading "reading" forever — so it is caught explicitly.
      let result: Awaited<ReturnType<typeof supabase.functions.invoke<TagResponseBody>>>;
      try {
        result = await supabase.functions.invoke<TagResponseBody>('tag-item', {
          body: { itemId: item.id, force: true },
        });
      } catch (err) {
        await restore();
        throw err instanceof Error ? err : new Error('Cinch couldn’t re-read this piece.');
      }

      if (result.error) {
        const { status, body } = await readHttpError(result.error);
        await restore();
        throw new Error(refusalMessage(status, body));
      }

      // 200, but the body decides — the function reports its own failures as
      // `{ ok: false, status: 'needs_review' }` with a 200, because losing an
      // item is unacceptable and a badged one is recoverable.
      const status = result.data?.status;
      if (status === 'tagged' || status === 'needs_review') return { status };

      await restore();
      throw new Error('Cinch couldn’t re-read this piece. Try again.');
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ['closet'] });
      void qc.invalidateQueries({ queryKey: ['review-queue'] });
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}
