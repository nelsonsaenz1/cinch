import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { createOperationIds, runCommand } from '@/lib/commands';
import { track } from '@/lib/posthog';
import type { Json } from '@/types/database';
import {
  describeWeights,
  meanFeatures,
  updateAffinities,
  updateWeights,
  type FeatureVector,
  type OutfitCandidate,
} from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';
import { withDeadline } from '@/features/closet/session';

import type { StyleProfile } from './queries';
import {
  classifyWearSessionFailure,
  classifyWearFailure,
  WearMutationError,
} from './wear-failure';

export type ReactionSource = 'today' | 'chat' | 'shuffle' | 'onboarding_quiz';

/**
 * Take back the last reaction this screen recorded about exactly these clothes.
 *
 * ── WHY A DELETE, AND NOT A THIRD VALUE ───────────────────────────────────
 *
 * `outfit_reactions.reaction` is `smallint not null check (reaction in (-1, 1))`
 * (migration 20260803210000). There is no neutral to write: a zero is refused by
 * the constraint, and inventing one would need a migration this run may not make.
 * The schema's own idiom for "cleared" is ABSENCE — the same idiom
 * `20260816190545_today_ratings_favorites` uses for `wear_rating` (null means
 * unrated) and `favorited_at` (null means not favourited), and the same one
 * `useSetDailyReaction` already uses when a daily reaction is retracted: "a
 * 'none' reaction would be a row that exists to say nothing".
 *
 * The permission for it already exists and predates this change:
 * `outfit_reactions: owner can delete` (20260803210000) plus the explicit
 * `grant select, insert, delete on outfit_reactions to authenticated`
 * (20260806100000). Nothing new is granted here.
 *
 * ── WHAT IT DOES NOT UNDO, STATED RATHER THAN GLOSSED ─────────────────────
 *
 * `apply_outfit_reaction` folded the reaction into `style_profiles.weights` when
 * it was recorded, and deleting the event does not run that arithmetic backwards
 * — nothing on the client or the server can, because the update is absolute
 * rather than incremental. What the delete buys is a TRUTHFUL CORPUS: every
 * reaction row stores its own `features` and `baseline` precisely so the model
 * can be replayed from the log (see 20260804202000's own note), and a replay
 * that still contained an opinion the user withdrew would relearn it forever. So
 * the retraction is permanent where it counts and silent where it does not.
 *
 * `feedback_count` is deliberately left alone: it is the optimistic-concurrency
 * version token, not a tally anyone reads, and decrementing it would make two
 * clients' snapshots agree when they do not.
 *
 * ── THE MATCH IS EXACT, AND SCOPED TO ONE OPINION ─────────────────────────
 *
 * `contains` + `containedBy` on the same array is set equality in PostgREST, so
 * this finds reactions about THIS outfit's clothes and no supersets of them; the
 * `source` filter keeps a Today retraction from reaching into an opinion given in
 * the stylist. Newest first, one row: taking back this morning's answer must not
 * also erase what the same three pieces were told last week.
 *
 * A miss is not an error. Nothing recorded is already the state being asked for.
 */
async function retractOutfitReaction(
  userId: string,
  itemIds: string[],
  source: ReactionSource,
): Promise<void> {
  const { data, error } = await supabase
    .from('outfit_reactions')
    .select('id')
    // RLS already scopes this to the owner. The filter is here so single-ness
    // does not depend on a policy staying exactly as narrow as it is today.
    .eq('user_id', userId)
    .eq('source', source)
    .contains('item_ids', itemIds)
    .containedBy('item_ids', itemIds)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;

  const row = data?.[0];
  if (!row) return;

  const { error: deleteError } = await supabase
    .from('outfit_reactions')
    .delete()
    .eq('id', row.id);
  if (deleteError) throw deleteError;
}

/**
 * Record a like or dislike and fold it into the learned model.
 *
 * The learning maths runs on the client because the client is where the rest of
 * the styling engine already lives — the same `updateWeights` that runs here
 * runs inside the offline generator, and keeping one implementation means the
 * two can never disagree about what a reaction is worth.
 *
 * The write is a single RPC so the reaction row and the updated model land
 * atomically. Consistency risk here is asymmetric: a model updated without its
 * reaction recorded can never be reconstructed, because the reaction log is the
 * only evidence the update happened.
 *
 * This mutation REQUIRES the network. There is no durable queue behind it, so a
 * reaction made offline is lost — which is why `ReactionBar` reports pending,
 * saved and failed as three different things instead of confirming the write
 * the moment the user taps. If offline reactions are ever wanted they need an
 * actual outbox; do not describe one here until it exists.
 *
 * ── `clear` — THE SAME SURFACE, RUN BACKWARDS ─────────────────────────────
 *
 * Added 2026-08-18 by founder order: Today's taste pills latched, and a control
 * that cannot be un-tapped is a control that records a mistake permanently. The
 * retraction is a flag on this mutation rather than a second hook because it is
 * the same fact about the same outfit — one call site, one pending state, one
 * failure story — and because a caller that had to choose between two hooks
 * would eventually call the wrong one. See `retractOutfitReaction` above for what
 * a clear does on the server and, more importantly, what it does not.
 */
export function useReactToOutfit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      candidate,
      shownAlongside,
      liked,
      profile,
      outfitId,
      reason,
      source = 'today',
      clear = false,
    }: {
      candidate: OutfitCandidate;
      /** Every candidate that was on screen, including this one. */
      shownAlongside: OutfitCandidate[];
      liked: boolean;
      profile: StyleProfile;
      outfitId?: string | null;
      reason?: string;
      source?: ReactionSource;
      /**
       * Take the reaction back rather than record one.
       *
       * `liked` is still read — it says WHICH pill the user tapped, which is
       * what the caller's optimistic state is keyed on — but nothing is learned
       * from it and no weights are computed, because there is no new opinion.
       */
      clear?: boolean;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      if (clear) {
        await retractOutfitReaction(
          userId,
          candidate.items.map((g) => g.id),
          source,
        );
        return { cleared: true as const };
      }

      const baseline: FeatureVector = meanFeatures(
        shownAlongside.length ? shownAlongside : [candidate],
      );

      const weights = updateWeights(profile.weights, candidate.features, baseline, liked);
      const affinities = updateAffinities(profile.affinities, candidate.items, liked);
      const summary = describeWeights(weights);

      const { data, error } = await supabase.rpc('apply_outfit_reaction', {
        p_item_ids: candidate.items.map((g) => g.id),
        p_reaction: liked ? 1 : -1,
        p_features: candidate.features,
        p_baseline: baseline,
        p_weights: weights,
        p_affinities: affinities,
        p_summary: summary,
        p_outfit_id: outfitId ?? undefined,
        p_reason: reason,
        p_source: source,
        // Which version of the profile these weights were derived from.
        //
        // `weights` above is an ABSOLUTE vector computed from the snapshot this
        // screen is holding. React twice in quick succession and both writes
        // derive from the same snapshot, so whichever lands second erases the
        // first while the count still rises twice — the profile then claims two
        // reactions' worth of learning and carries one. Sending the version lets
        // the server refuse a superseded write instead of applying it blindly.
        p_expected_feedback_count: profile.feedbackCount,
      });

      if (error) throw error;

      // The reaction itself is always recorded; only the weight update can be
      // refused. `applied: false` means someone beat us to it, so the local
      // vector is stale and must not be written into the cache.
      const applied = (data as { applied?: boolean } | null)?.applied !== false;
      return { cleared: false as const, weights, affinities, summary, applied };
    },

    onSuccess: (next, vars) => {
      // Either way the remembered reactions changed — the ranking-time reader
      // (use-outfit-reactions.ts, ledger A9) must see the new row, or the
      // absence of the retracted one, on the next generation.
      void qc.invalidateQueries({ queryKey: ['outfit-reactions'] });

      // A retraction is SILENT, and deliberately so — the same rule
      // `useSetDailyReaction` states: "a retraction measured as an event would
      // be a record of a person changing their mind". There is also nothing to
      // write into the profile cache, because the delete moved no weights and
      // no version token; see `retractOutfitReaction`.
      if (next.cleared) return;

      // Boolean and source only. The candidate's items, reason text and
      // feature vector are user data and stay out of analytics.
      track('outfit_reacted', { liked: vars.liked, source: vars.source ?? 'today' });
      if (!next.applied) {
        // Refetch rather than merge: the authoritative profile already contains
        // the other reaction's learning, and this one's event is on record to be
        // replayed. Writing our stale vector here would undo exactly what the
        // server just protected.
        void qc.invalidateQueries({ queryKey: ['style-profile'] });
        return;
      }

      // Write straight into the cache so the next generation on this screen
      // already reflects the reaction. Waiting for a refetch would let the user
      // dislike an outfit and immediately be shown its twin.
      qc.setQueryData<StyleProfile>(['style-profile'], (prev) =>
        prev
          ? {
              ...prev,
              weights: next.weights,
              affinities: next.affinities,
              summary: next.summary,
              feedbackCount: prev.feedbackCount + 1,
            }
          : {
              weights: next.weights,
              affinities: next.affinities,
              summary: next.summary,
              feedbackCount: 1,
            },
      );
      void qc.invalidateQueries({ queryKey: ['style-profile'] });
    },
  });
}

/**
 * Persist a generated outfit and mark it worn.
 *
 * A wear is a fact, not automatically praise. Optional 1–5 feedback and the
 * private favorite marker are persisted with that fact; callers decide which
 * explicit feedback should update the learned model.
 *
 * One call, not three. This used to insert the outfit, insert its items, and
 * then call `log_outfit_wear`, which meant a dropped connection could leave an
 * outfit with no garments in it or a wear that was never counted — and a retry
 * created a second outfit while incrementing `wear_count` twice, quietly
 * corrupting cost-per-wear and the freshness rule. `wear_outfit_tx` is all
 * three writes in one transaction, keyed by an operation id so the retry
 * returns the original outfit instead of repeating it.
 */
export function useWearOutfit() {
  const qc = useQueryClient();

  // Held across renders: the id must survive a retry of the same tap, which is
  // the only thing that makes the command idempotent.
  const opIds = useRef(createOperationIds()).current;

  return useMutation({
    mutationFn: async ({
      candidate,
      context,
      name,
      reasoning,
      origin = null,
      rating = null,
      favorite = false,
    }: {
      candidate: OutfitCandidate;
      context: unknown;
      name: string;
      reasoning: string;
      /**
       * The kept plate this wearing came out of, when there was one.
       *
       * This is the ONLY moment the lineage can be recorded. Every confirm
       * inserts a fresh `outfits` row — which is right, a wear is an event and
       * two wearings are two events — so a kept plate has no way to find the
       * wears that came out of it unless the pointer is written here.
       * `count(*) where origin_outfit_id = <plate>` is what makes KP-01's
       * "worn 6×" a fact rather than a wish, and it cannot be backfilled.
       *
       * Null for a look the stylist proposed this morning, which is most of
       * them: nothing came before it.
       */
      origin?: string | null;
      /** Optional explicit feedback. Null is an honest unrated wear. */
      rating?: number | null;
      /** Owner-private favorite marker for the newly created wear. */
      favorite?: boolean;
    }) => {
      // This is a bounded local preflight, not the write authority. The RPC
      // still carries the JWT and Postgres RLS still authorizes every row.
      // Avoiding getClaims() here removes a second unbounded network hop before
      // the real command while still refusing an explicitly signed-out state.
      try {
        const { data } = await withDeadline(
          supabase.auth.getSession(),
          8_000,
          'Sign-in check',
        );
        if (!data.session) throw new WearMutationError('signed_out');
      } catch (error) {
        if (error instanceof WearMutationError) throw error;
        throw new WearMutationError(classifyWearSessionFailure(error), error);
      }

      const itemIds = candidate.items.map((g) => g.id);
      // The garments are what identifies the action — the same set of clothes
      // tapped twice in a row is one wear being retried, not two wears.
      const actionKey = itemIds.join('.');

      let outfitId: string;
      try {
        outfitId = await runCommand('wear_outfit_tx', {
          p_op_id: opIds.for(actionKey),
          p_item_ids: itemIds,
          p_name: name,
          p_reasoning: reasoning,
          p_context: context == null ? undefined : (context as Json),
          p_source: 'ai',
          p_origin: origin ?? undefined,
          p_wear_rating: rating ?? undefined,
          p_favorite: favorite,
        });
      } catch (error) {
        throw new WearMutationError(classifyWearFailure(error), error);
      }

      opIds.settle(actionKey);
      return outfitId;
    },

    onSuccess: () => {
      track('outfit_worn');
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
      // The Repeat reads this to know whether today's suggestion is a real
      // repeat and, eventually, an exhausted closet — it must see a wear the
      // moment it is logged, not on the next natural refetch.
      void qc.invalidateQueries({ queryKey: ['worn-outfits'] });
      void qc.invalidateQueries({ queryKey: ['favorite-outfits'] });
    },
  });
}
