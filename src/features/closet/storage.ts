import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { closetUserId, withDeadline } from '@/features/closet/session';
import { getUserId, supabase } from '@/lib/supabase';
import { itemColor, type Item } from '@/schemas/item';
import type { Database } from '@/types/database';

type ItemRow = Database['public']['Tables']['items']['Row'];

/**
 * Storage — the reversible half of taking a piece out of rotation.
 *
 * ── What storage costs, said plainly ──────────────────────────────────────
 *
 * A stored piece STILL SPENDS A CLOSET SLOT. `enforce_item_limit`
 * (migrations/20260805160000:271) runs `select count(*) from items where
 * user_id = $1` with no archive filter, and the comment above it says why in
 * so many words: excluding archived rows would make "archive everything" an
 * unlimited free closet. `useCapacity` already mirrors that count exactly, so
 * moving thirty pieces to storage moves the "24 of 30" figure by nothing.
 * Nowhere in this feature — not the screen copy, not a hook name, not a toast —
 * may imply otherwise. The user is trading grid clutter for nothing but grid
 * clutter, and that is a fair trade only if they are told it is the trade.
 *
 * ── Why a Storage SCREEN, and not just an archive action ──────────────────
 *
 * `useRemoveItems` (features/closet/mutations.ts) rejects `is_archived` as the
 * implementation of Remove, and its first reason is exactly the cost above:
 * *"Nothing in the app can unarchive, so an archived row would burn one of
 * thirty slots permanently."* That objection is about a one-way door, not about
 * the flag. A door with a handle on both sides is a different object: the slot
 * is occupied while the piece is stored and released the moment they delete it
 * for good, and they can always see what is holding their slots and get it back.
 *
 * So this file does not overturn that docblock, it satisfies the condition in
 * it. Remove stays a hard delete that destroys the photographs; storage keeps
 * every byte, because the photographs are the entire reason to keep a piece you
 * are not currently wearing.
 *
 * ── Restoring is not gated, and this was checked ──────────────────────────
 *
 * `create trigger items_enforce_limit before insert on items`
 * (migrations/20260805160000:283) — INSERT only, no `or update`, and the
 * function body reads only `new.user_id`. An UPDATE back to
 * `is_archived = false` therefore cannot be refused for capacity, which is the
 * correct behaviour rather than a loophole: the row was already counted the
 * whole time it sat in storage, so restoring it consumes nothing new. Should
 * that trigger ever grow `or update`, restore would begin failing with
 * `closet_limit_reached` and the mutation's error would surface it verbatim —
 * this comment is the thing to come back to.
 */

const itemColorList = z.array(itemColor);

/**
 * The row→`Item` mapping, duplicated on purpose and reluctantly.
 *
 * `toItem` and `toColors` live in features/closet/queries.ts and are private to
 * it; that file is off-limits to this change, so exporting them is not
 * available. The duplication is deliberately kept to the two things a storage
 * tile actually reads through `pieceName` — the identity columns and the salvaged
 * colours — with the rest of the shape mapped straight across, rather than a
 * second copy of the whole docblocked derivation drifting alongside the first.
 * If these two ever need to agree about anything subtler than field names, the
 * right move is to lift `toItem` into its own module, not to widen this copy.
 *
 * The colour salvage is queries.ts's rule applied more quietly: `colors` is
 * unconstrained `jsonb`, one malformed swatch must not cost the item the ones
 * that parsed, and an unreadable colour is not grounds for hiding a garment the
 * user owns. No `console.warn` here — the closet read runs on every launch and
 * has already reported any bad row long before this screen is opened.
 */
function toStoredItem(row: ItemRow): Item {
  const whole = itemColorList.safeParse(row.colors);
  const colors = whole.success
    ? whole.data
    : Array.isArray(row.colors)
      ? row.colors.flatMap((entry) => {
          const one = itemColor.safeParse(entry);
          return one.success ? [one.data] : [];
        })
      : [];

  return {
    id: row.id,
    userId: row.user_id,
    imagePath: row.image_path,
    cutoutPath: row.cutout_path,
    platePath: row.plate_path,
    thumbPath: row.thumb_path,
    status: row.status,
    category: row.category,
    subcategory: row.subcategory,
    colors,
    pattern: row.pattern,
    material: row.material,
    brand: row.brand,
    formalityScore: row.formality_score,
    warmthScore: row.warmth_score,
    waterResistant: row.water_resistant,
    fit: row.fit,
    patternScale: row.pattern_scale,
    seasons: row.seasons,
    occasions: row.occasions,
    description: row.description,
    purchasePrice: row.purchase_price,
    purchaseDate: row.purchase_date,
    wearCount: row.wear_count,
    lastWornAt: row.last_worn_at,
    isArchived: row.is_archived,
    isForSale: row.is_for_sale,
    userVerified: row.user_verified,
    createdAt: row.created_at,
  };
}

/**
 * Everything the user has put in storage, newest first.
 *
 * The mirror image of `useCloset`'s filter, and it borrows that query's whole
 * contract: the id comes from `closetUserId()` (the locally persisted session
 * with a deadline, never `getClaims()` — see features/closet/session.ts), the
 * abort `signal` is threaded into PostgREST, and a missing session throws
 * rather than resolving to `[]`. "Nothing in storage" is a claim, and this
 * screen's empty state is the only thing standing between the user and the
 * belief that pieces they stored are gone.
 *
 * `['closet','stored']` sits under the `closet` prefix so that any invalidation
 * of the closet reaches it — the two lists are two filters over one table and
 * must never disagree about which side a piece is on.
 */
export function useStoredCloset() {
  return useQuery({
    queryKey: ['closet', 'stored'],
    queryFn: async ({ signal }): Promise<Item[]> => {
      const userId = await closetUserId();
      if (!userId) {
        throw new Error("Couldn't confirm your session. Check your connection and try again.");
      }

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', true)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) throw error;
      return (data ?? []).map(toStoredItem);
    },
  });
}

/**
 * How long the auth lookup behind one of these writes may pend before it fails
 * honestly — the same deadline, for the same reason, as the one guarding
 * `useRemoveItems`. `getUserId` calls `getClaims()`, which on Hermes round-trips
 * to the auth server and can pend forever.
 */
const AUTH_DEADLINE_MS = 8_000;

/**
 * Every list whose answer changes when a piece crosses between the closet and
 * storage.
 *
 * `['closet']` prefix-matches `['closet','stored']` in React Query v5, so both
 * of this feature's lists are covered; the key is named explicitly all the same
 * because it is the pair being kept in step and a reader should not have to
 * know the matching rule to see that.
 *
 * `['wardrobe']` is not optional garnish. `useWardrobe` (features/styling/
 * queries.ts) filters `is_archived = false` and is what the outfit engine plans
 * from — without this line the stylist keeps building looks around a piece the
 * user just put away, which would make the screen's promise that stored pieces
 * stay "out of your plans" false.
 *
 * `['closet-count']` is deliberately NOT here. That query mirrors the limit
 * trigger's unfiltered `count(*)` on purpose (features/billing/use-capacity.ts),
 * and storing a piece does not change it by one. Invalidating it would be a
 * wasted read whose only effect could be to redraw a capacity figure that has
 * not moved — and if it ever appeared to move, the honest reading would be that
 * this feature was lying about what storage costs.
 */
function invalidateAfterStorageMove(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: ['closet'] });
  void qc.invalidateQueries({ queryKey: ['closet', 'stored'] });
  void qc.invalidateQueries({ queryKey: ['wardrobe'] });
}

/**
 * The shared write behind both directions.
 *
 * The update selects back what it changed and treats an empty result as the
 * failure it is, exactly as `useUnverifyItem` does and for the same reason:
 * `items: owner can update` (migrations/20260803154431:131) scopes USING to
 * `auth.uid() = user_id`, so a row that is not the caller's matches nothing and
 * PostgREST answers 200 with zero rows. A move that silently moved nothing must
 * not be reported as a move.
 */
async function setArchived(ids: string[], archived: boolean, failure: string): Promise<number> {
  if (ids.length === 0) return 0;

  const userId = await withDeadline(getUserId(), AUTH_DEADLINE_MS, 'Sign-in check');
  if (!userId) throw new Error('Not signed in.');

  const { data, error } = await supabase
    .from('items')
    .update({ is_archived: archived })
    .in('id', ids)
    .eq('user_id', userId)
    .select('id');

  if (error) throw error;
  if (!data?.length) throw new Error(failure);

  return data.length;
}

/**
 * Move pieces out of rotation.
 *
 * Nothing is deleted — not the row, and above all not a single storage object.
 * `useRemoveItems` clears the bucket first and the row second because its
 * promise is that the photographs are gone; this hook's promise is the
 * opposite one, and the photographs surviving is the entire point of it. A
 * stored piece keeps its cutout, its plate and its thumbnail so that the
 * Storage screen can show them what they own and Restore can return it intact.
 *
 * Wear history is untouched for the same reason: `wear_count` and `last_worn_at`
 * are facts about a garment's past, and putting it in a drawer does not unwear it.
 */
export function useArchiveItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const moved = await setArchived(ids, true, 'Cinch couldn’t move that to storage.');
      return { archived: moved };
    },
    onSuccess: () => invalidateAfterStorageMove(qc),
  });
}

/**
 * Bring pieces back into the closet.
 *
 * Not gated by the closet limit — see this file's header for the trigger read
 * that establishes it (`before insert`, and only insert). If the database ever
 * refuses anyway, the raised `closet_limit_reached` message travels up
 * untouched rather than being swallowed into a generic failure: the one thing
 * worse than a restore that cannot happen is a restore that reports success.
 */
export function useRestoreItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids }: { ids: string[] }) => {
      const moved = await setArchived(ids, false, 'Cinch couldn’t bring that back.');
      return { restored: moved };
    },
    onSuccess: () => invalidateAfterStorageMove(qc),
  });
}
