import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { GarmentSearchSheet } from '@/components/ingest/garment-search-sheet';
import { UploadQueueList } from '@/components/ingest/upload-queue-list';
import { useAiConsent, useGrantAiConsent } from '@/features/auth/use-consent';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { useCapture } from '@/features/ingest/use-capture';
import { useQueueStore, selectActiveCount } from '@/features/ingest/queue-store';
import { drainQueue } from '@/features/ingest/upload-queue';
import { useTheme } from '@/theme/tokens';

/** One L of the framing guide. Light lines on the dark stage, per the design. */
function Corner({ canvas, pos }: { canvas: string; pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const edges = {
    tl: { top: 20, left: 20, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
    tr: { top: 20, right: 20, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
    bl: { bottom: 20, left: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
    br: { bottom: 20, right: 20, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  } as const;
  return (
    <View
      style={{ position: 'absolute', width: 22, height: 22, borderColor: canvas, opacity: 0.55, ...edges[pos] }}
    />
  );
}

/** The three ways a garment gets into the closet from this screen. */
type CaptureAction = 'library' | 'camera' | 'describe';

export default function CaptureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { pickFromLibrary, takePhoto, selectionLimit } = useCapture();

  const qc = useQueryClient();
  const capacity = useCapacity();
  const gate = useGate();

  const jobs = useQueueStore((s) => s.jobs);
  const hydrate = useQueueStore((s) => s.hydrate);

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const [consentVisible, setConsentVisible] = useState(false);
  // The third way in: describing a garment rather than photographing it. Passes
  // the same gates as the picker, because it ends in the same INSERT and the
  // same model call.
  const [describeVisible, setDescribeVisible] = useState(false);
  // What to run once consent lands, so the user isn't made to tap twice.
  const [pendingAction, setPendingAction] = useState<null | CaptureAction>(null);

  // Rehydrate a batch interrupted by a kill or a crash, and resume it.
  useEffect(() => {
    hydrate();
    void drainQueue();
  }, [hydrate]);

  // All three ways in dispatch from one place. The gate below reaches for this
  // twice, and inlining a ternary at each site is how the second entry point
  // was written — a third would have made that three copies of one decision.
  const run = useCallback(
    (action: CaptureAction) => {
      if (action === 'library') void pickFromLibrary();
      else if (action === 'camera') void takePhoto();
      else setDescribeVisible(true);
    },
    [pickFromLibrary, takePhoto],
  );

  /**
   * Gate every capture entry point, in the order the user should meet the gates.
   *
   * CAPACITY BEFORE CONSENT, deliberately. A full closet means this garment
   * cannot be added at all, so asking for AI permission first collects a
   * decision we have no use for — and it asks for something invasive
   * (photographs going to a model) moments before refusing the thing they
   * asked for. Whichever gate the user cannot pass should be the only one they
   * are shown.
   *
   * BOTH BEFORE THE PICKER. `items_enforce_limit` refuses the INSERT, which
   * happens after the photograph is taken, cut out and uploaded. Letting the
   * user get that far and then failing is the thing worth avoiding: the server
   * is still the authority, this just moves the "no" to before the work rather
   * than after it.
   */
  const guarded = useCallback(
    (action: CaptureAction) => {
      if (capacity.full) {
        // Superwall decides whether this particular user sees a paywall. On a
        // grant, dispatch the picker DIRECTLY — not back through this guard.
        // The refreshed `capacity` lives in a re-render this callback's closure
        // will never see (the await resumes as a microtask, before React
        // re-renders), so re-entering the gate would read the stale `full` and
        // show a paying user the paywall a second time. Skipping the client
        // check is safe because it was never the authority: the database
        // trigger still refuses the insert if the plan somehow didn't change.
        void gate.present(Placement.AddGarmentOverLimit, async () => {
          await Promise.all([
            qc.invalidateQueries({ queryKey: ['subscription'] }),
            qc.invalidateQueries({ queryKey: ['closet-count'] }),
          ]);
          run(action);
        });
        return;
      }

      if (consent.data?.granted) {
        run(action);
        return;
      }
      setPendingAction(action);
      setConsentVisible(true);
    },
    [capacity.full, gate, qc, consent.data?.granted, run],
  );

  const onAcceptConsent = async () => {
    await grantConsent.mutateAsync();
    setConsentVisible(false);
    const next = pendingAction;
    setPendingAction(null);
    if (next) run(next);
  };

  // A light tap on the two capture controls, matching the Buttons this dark
  // control row replaces. Best-effort only — haptics no-op during a camera
  // session and in Low Power Mode, so the pressed state is the real feedback.
  const start = useCallback(
    (action: CaptureAction) => {
      void Haptics.selectionAsync().catch(() => {
        /* haptics are best-effort; never block the action */
      });
      guarded(action);
    },
    [guarded],
  );

  // Progress is read entirely off the real upload/tag queue — never fabricated.
  const total = jobs.length;
  const doneCount = jobs.filter((j) => j.stage === 'done').length;
  const failedCount = jobs.filter((j) => j.stage === 'failed').length;
  const active = selectActiveCount(jobs); // queued + in-flight, i.e. still to process
  const allDone = total > 0 && active === 0;
  const fraction = total ? doneCount / total : 0;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      {/* The capture stage is the one dark screen in a light-only app; the
          global status bar is dark-on-light, which would vanish here. */}
      <StatusBar style="light" />
      <View className="flex-row items-center justify-between px-gutter pt-1">
        <Text variant="heading" style={{ color: theme.canvas }}>
          Add clothes
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={() => router.back()}
          className="py-2">
          <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
            Close
          </Text>
        </Pressable>
      </View>

      {/* The framed stage. The real capture runs in the system camera/picker, so
          this is an instructional viewfinder — a frame and a rule of thumb, not
          a live preview. */}
      <View className="mx-4 my-2 flex-1 items-center justify-center overflow-hidden rounded-plate">
        <View className="absolute inset-0 bg-surface" style={{ opacity: 0.04 }} />
        <Corner canvas={theme.canvas} pos="tl" />
        <Corner canvas={theme.canvas} pos="tr" />
        <Corner canvas={theme.canvas} pos="bl" />
        <Corner canvas={theme.canvas} pos="br" />
        <View style={{ opacity: 0.5 }}>
          <SymbolView name="tshirt" size={44} tintColor={theme.canvas} />
        </View>
        <Text
          variant="caption"
          className="absolute"
          style={{ bottom: 22, color: theme.canvas, opacity: 0.75 }}>
          One garment, plain background
        </Text>
      </View>

      {/* Library · shutter · describe. There is no "Flip" here: with no in-app
          live preview there is nothing to flip — the system camera carries its
          own flip control. "Describe" occupies the slot that used to be a
          spacer, which keeps the shutter centred and gives the quiet third way
          in the same weight as the library: it is the door for the garments
          somebody will never get round to photographing. */}
      <View className="flex-row items-center justify-between px-8 py-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          hitSlop={12}
          onPress={() => start('library')}
          className="w-16 py-2">
          <Text variant="label" style={{ color: theme.canvas }}>
            Library
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          onPress={() => start('camera')}
          className="items-center justify-center active:opacity-80"
          style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 3, borderColor: theme.canvas }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: theme.canvas }} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Describe it instead"
          accessibilityHint="Find a picture of a garment by describing it"
          hitSlop={12}
          onPress={() => start('describe')}
          className="w-16 items-end py-2">
          <Text variant="label" style={{ color: theme.canvas }}>
            Describe
          </Text>
        </Pressable>
      </View>

      {/* The progress sheet — bg-surface, rounded top corners, flush to the
          bottom edge. Everything below is driven by the queue state. */}
      <View className="rounded-t-plate bg-surface px-5 pt-4" style={{ paddingBottom: insets.bottom + 20 }}>
        {total === 0 ? (
          <>
            <Text variant="plate">Photograph your closet</Text>
            <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
              {`Pick up to ${selectionLimit} photos at a time, or shoot pieces one by one. Cinch cuts out the background and tags everything for you.`}
            </Text>
          </>
        ) : (
          <>
            <View className="flex-row items-baseline justify-between">
              <Text variant="stat">
                {allDone
                  ? failedCount > 0
                    ? `Added ${doneCount} of ${total}`
                    : 'All added'
                  : `Processing ${Math.min(doneCount + 1, total)} of ${total}`}
              </Text>
              {!allDone ? (
                <Text variant="caption" style={{ color: theme.faint }}>{`${active} to go`}</Text>
              ) : failedCount > 0 ? (
                <Text variant="caption" style={{ color: theme.critical }}>
                  {`${failedCount} couldn't be added`}
                </Text>
              ) : null}
            </View>

            {allDone ? (
              <View className="mt-3" />
            ) : (
              <View className="my-3 h-1.5 overflow-hidden rounded-full bg-sand">
                <View
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.round(fraction * 100)}%` }}
                />
              </View>
            )}

            <UploadQueueList jobs={jobs} />

            {doneCount > 0 ? (
              <Button
                title="Review tags"
                variant={allDone ? 'primary' : 'secondary'}
                onPress={() => router.replace('/review')}
                haptic
                className="mt-4"
              />
            ) : null}
          </>
        )}
      </View>

      {/* Imported garments arrive at `pending_tag` like photographed ones, so
          the review deck is the same next step — sent there directly because
          this screen's own progress panel is driven by the upload queue, which
          a described garment never touches. */}
      <GarmentSearchSheet
        visible={describeVisible}
        onClose={() => setDescribeVisible(false)}
        onImported={() => router.replace('/review')}
      />

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => void onAcceptConsent()}
        onDecline={() => {
          setConsentVisible(false);
          setPendingAction(null);
        }}
      />
    </SafeAreaView>
  );
}
