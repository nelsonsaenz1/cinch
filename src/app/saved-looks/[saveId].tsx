import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ProvenanceRow,
  RemoveSaveDialog,
  SavedErrorState,
  UnavailableNotice,
} from '@/components/saved-looks';
import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  SAVED_EVENTS,
  detailViewedProps,
  sourceUnavailableSeenProps,
} from '@/features/saved-looks/analytics';
import {
  DETAIL,
  PREVIEW_UNAVAILABLE,
  SAVED_TITLE,
  UNAVAILABLE,
  unavailablePrivacyNote,
} from '@/features/saved-looks/copy';
import { provenanceDate, savedAtLine } from '@/features/saved-looks/dates';
import { useDeleteSave } from '@/features/saved-looks/mutations';
import { useSavedLook } from '@/features/saved-looks/queries';
import { canPlan, resolveSavedDetailState } from '@/features/saved-looks/states';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';
import { useTheme } from '@/theme/tokens';

/**
 * OS-04 and OS-06 — one saved look, and the two things it can be.
 *
 * ── ONE ROUTE, TWO FRAMES, AND THAT IS THE HANDOFF'S OWN CHOICE ────────────
 *
 * §1: "OS-06 is the same route when the source resolves to `unavailable`." The
 * difference is not a different screen, it is the same row read again — the
 * `availability` column of `saved_looks_resolved` is recomputed on every fetch,
 * so a look that was fine when the grid was drawn can be honestly unavailable
 * by the time it is opened. A separate route would have to be navigated to on
 * the strength of a value that may already be stale.
 *
 * ── THE PRIVATE HALF IS LABELLED, AND THE LABEL IS TRUE ────────────────────
 *
 * "Private to you" over the note, the collection and the save time. The card
 * says it because the select policy is `(select auth.uid()) = owner_id` and
 * there is no second read path — not for a friend, not for the person whose
 * look it was. 21_saved_looks.sql asserts the source owner gets nothing, at 14.
 *
 * ── AND WHAT OS-06 REPLACES ────────────────────────────────────────────────
 *
 * Not just the notice. The whole action row changes: "Plan this look" goes,
 * because planning reads the SOURCE to know what the look was made of and the
 * source is exactly what is no longer readable — `canPlan` refuses it rather
 * than this screen deciding. What arrives instead is "Keep note only", which is
 * a way OUT of the screen rather than a mutation: the save is already retained,
 * the note is already kept, and the honest button is one that says so and goes
 * back.
 */
export default function SavedLookDetailScreen() {
  const router = useRouter();
  const { saveId } = useLocalSearchParams<{ saveId: string }>();

  const query = useSavedLook(saveId ?? null);
  const remove = useDeleteSave();

  const [confirming, setConfirming] = useState(false);

  const state = useMemo(
    () =>
      resolveSavedDetailState({
        loading: query.isLoading,
        failed: query.isError,
        save: query.data ?? null,
      }),
    [query.isLoading, query.isError, query.data],
  );

  const save = state.kind === 'available' || state.kind === 'unavailable' ? state.save : null;

  /**
   * The detail was genuinely drawn.
   *
   * The four facts are lifted out of `save` BEFORE the effect rather than read
   * inside it, and that is not a lint dance — it is what makes the dependency
   * list honest. `save` is a fresh object on every background refetch, so an
   * effect that depended on it would re-fire on every poll and inflate a
   * denominator; these four are the values that actually decide whether
   * anything new happened, and a revocation that lands while the screen is open
   * changes one of them, which is the transition worth counting twice.
   */
  const drawnId = save?.id;
  const drawnAvailability = save?.availability;
  const drawnHasNote = Boolean(save?.note);
  const drawnSourceType = save?.sourceType;

  useEffect(() => {
    if (!drawnId || !drawnAvailability || !drawnSourceType) return;
    track(
      SAVED_EVENTS.detailViewed,
      detailViewedProps({ availability: drawnAvailability, hasNote: drawnHasNote }),
    );
    if (drawnAvailability === 'unavailable') {
      track(SAVED_EVENTS.sourceUnavailableSeen, sourceUnavailableSeenProps(drawnSourceType));
    }
  }, [drawnId, drawnAvailability, drawnHasNote, drawnSourceType]);

  /**
   * A row that is not there is not an error, and it is not a screen either.
   *
   * `missing` means RLS matched nothing: removed here, or on another device.
   * The right answer is to leave, silently — an apology for a thing the reader
   * themselves deleted is noise, and one for a thing deleted on their other
   * phone is a mystery.
   */
  useEffect(() => {
    if (state.kind !== 'missing') return;
    if (router.canGoBack()) router.back();
    else router.replace('/saved-looks');
  }, [state.kind, router]);

  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/saved-looks');
  }, [router]);

  /** §8: `notificationAsync(Warning)` when the sheet OPENS, never on the confirm. */
  const askToRemove = useCallback(() => {
    haptics.warning();
    setConfirming(true);
  }, []);

  const confirmRemove = useCallback(() => {
    if (!save) return;
    haptics.destructiveConfirm();
    remove.mutate(
      { saveId: save.id, sourceType: save.sourceType, via: 'detail' },
      {
        onSuccess: () => {
          setConfirming(false);
          back();
        },
        // The dialog stays open on failure with its buttons live again. A
        // confirm that closed on a failed delete would tell the reader the look
        // is gone when it is not.
        onError: () => setConfirming(false),
      },
    );
  }, [save, remove, back]);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={SAVED_TITLE} align="leading" onBack={back} backLabel={SAVED_TITLE} />

      {state.kind === 'loading' || state.kind === 'missing' ? (
        <View className="gap-4 px-gutter pt-4" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {/* 360, not 300 — the Hero's own height for a save with an image,
              which is nearly all of them. Anything shorter drops the title and
              everything under it 60pt the moment the photo lands. */}
          <Skeleton className="h-[360px] w-full rounded-plate" />
          <Skeleton className="h-[26px] w-2/3 rounded-sm" />
          <Skeleton className="h-[60px] w-full rounded-md" />
        </View>
      ) : state.kind === 'error' ? (
        <SavedErrorState onRetry={() => void query.refetch()} retrying={query.isRefetching} />
      ) : save ? (
        <ScrollView contentContainerClassName="px-gutter pb-16">
          <Hero imageUrl={save.imageUrl} unavailable={save.availability === 'unavailable'} />

          {/* No `numberOfLines`. A long title wraps; nothing here is clipped. */}
          <Text variant="title" trim className="mt-4" accessibilityRole="header">
            {save.title?.trim() || 'Untitled look'}
          </Text>

          {save.availability === 'unavailable' ? (
            <View className="mt-4">
              <UnavailableNotice sourceName={sourceName(save.sourceLabel)} />
            </View>
          ) : (
            <View className="mt-4">
              <ProvenanceRow
                sourceLabel={save.sourceLabel}
                visibility={save.sourceVisibility}
                when={provenanceDate(save.sourceAt)}
              />
            </View>
          )}

          {/*
            The heading changes with the state and the card does not. OS-04 says
            "Private to you" over a card of three rows; OS-06 says "What you
            kept" over the same card with the collection row gone — because a
            look whose source is unavailable is still on whatever shelf the
            reader put it on, but "Collection" beside a look you can no longer
            see reads as an offer to organise something that is not there.
          */}
          <Text variant="eyebrow" className="mt-6 text-muted">
            {save.availability === 'unavailable' ? UNAVAILABLE.keptHeader : DETAIL.privateHeader}
          </Text>

          <View className="mt-2 overflow-hidden rounded-md border border-sand">
            {save.note ? (
              <View className="gap-1 border-b border-sand p-3">
                <Text variant="caption" className="text-muted">
                  {DETAIL.noteLabel}
                </Text>
                <Text variant="body">{save.note}</Text>
              </View>
            ) : null}
            <View className="flex-row items-center justify-between gap-x-3 p-3">
              <Text variant="body" className="flex-none">{DETAIL.savedLabel}</Text>
              <Text variant="body" className="text-right text-muted" style={{ flexShrink: 1 }}>
                {savedAtLine(save.savedAt)}
              </Text>
            </View>
          </View>

          {save.availability === 'unavailable' ? (
            <Text variant="caption" className="mt-4 text-muted">
              {unavailablePrivacyNote(sourceName(save.sourceLabel))}
            </Text>
          ) : null}

          {/*
            The actions, stacked full-width at every size rather than only at AX.
            §9 asks for the stack at AX-XXXL; drawing it always is one layout to
            be right about instead of two, and three 50pt buttons in a column is
            the shape the detail already has at the top of its scroll.
          */}
          <View className="mt-6 gap-3">
            {/*
              OS-04'S "PLAN THIS LOOK" IS NOT DRAWN, AND ITS ABSENCE IS
              DELIBERATE RATHER THAN UNFINISHED.

              The matcher exists and is tested (`features/saved-looks/plan-match`
              — matched/missing resolution, the one-item-one-slot rule, and
              `canCreatePlan`), and so does the write
              (`useCreatePlanFromSave`, through the existing `plan_outfit_tx`).
              What is missing is the read in between: OS-08 needs the SOURCE
              look's visible pieces, and this client deliberately does not hold a
              `source_id` — `toSavedLook` drops it at the mapping boundary
              because a component holding a pointer into somebody else's data is
              a component that will eventually try to follow it.

              Resolving those pieces belongs on the server, as the handoff's own
              `planFromSave(id)` RPC: one SECURITY DEFINER function that answers
              with what the reader could already see, so the client never gets a
              handle it could aim somewhere else. That function is not in
              20260820000000, so the button has nowhere to go — and a primary
              action that navigates to a screen that cannot work is worse than an
              action that is not offered yet. `canPlan` is imported and asserted
              in the tests so the gate is ready the day the RPC lands.
            */}
            {canPlan(save.availability) ? null : (
              // "Keep note only" is a way out, not a mutation: the save is
              // already retained and the note is already kept. A button that
              // wrote something here would be writing a value that is already
              // true, and a failure of it would be a failure of nothing.
              <Button title={UNAVAILABLE.keep} variant="secondary" onPress={back} />
            )}

            <Button
              title={save.availability === 'unavailable' ? UNAVAILABLE.remove : DETAIL.removeCta}
              variant={save.availability === 'unavailable' ? 'primary' : 'secondary'}
              haptic={false}
              onPress={askToRemove}
            />
          </View>
        </ScrollView>
      ) : null}

      {save ? (
        <RemoveSaveDialog
          visible={confirming}
          title={save.title}
          sourceLabel={save.sourceLabel}
          pending={remove.isPending}
          onCancel={() => setConfirming(false)}
          onRemove={confirmRemove}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * The hero.
 *
 * An unavailable save may still HAVE its snapshot image URL — the snapshot is
 * retained on purpose — but the URL points at storage the reader may no longer
 * be entitled to read, and a broken image is a worse answer than an honest one.
 * So "Preview unavailable" is drawn from the availability rather than from a
 * load failure: it is a fact known before the request, and a placeholder that
 * waits for a 403 is a placeholder that flashes.
 */
function Hero({ imageUrl, unavailable }: { imageUrl: string | null; unavailable: boolean }) {
  const theme = useTheme();

  if (unavailable || !imageUrl) {
    return (
      <View className="mt-2 h-[300px] items-center justify-center gap-3 rounded-plate border border-sand bg-tray">
        <SymbolView name="eye.slash" size={28} tintColor={theme.faint} />
        <Text variant="caption" className="text-muted">
          {PREVIEW_UNAVAILABLE}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: imageUrl }}
      accessible={false}
      contentFit="cover"
      transition={0}
      className="mt-2 h-[360px] w-full rounded-plate bg-tray"
    />
  );
}

/**
 * The bare name out of a snapshot label.
 *
 * "Ava's Daily look" → "Ava", so `unavailableBody` and `unavailablePrivacyNote`
 * can build their own possessives without doubling the apostrophe. A label with
 * no possessive in it ("Your outfit", "Event look") yields nothing and the copy
 * falls back to its neutral phrasing — which is right, because those two cases
 * have no other person in them to name.
 *
 * Both curly and straight apostrophes are matched: the snapshot is written by
 * whichever surface offered the save, and the app's own copy uses the curly one
 * while a name typed by a user may carry either.
 */
function sourceName(sourceLabel: string): string {
  const match = /^(.+?)['’]s\s/.exec(sourceLabel.trim());
  return match?.[1] ?? '';
}
