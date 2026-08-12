import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptionStep } from '@/components/share-look/caption-step';
import { EmptyClosetPrompt, FailedDraftBanner } from '@/components/share-look/edge-states';
import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { StackComposer } from '@/components/share-look/stack-composer';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { KeyboardAwareScrollView } from '@/components/ui/keyboard-aware-scroll-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useEventPosts } from '@/features/event-outfits/queries';
import { MAX_LOOKS_PER_BOARD } from '@/features/event-outfits/types';
import { useEvent, useEventMembers } from '@/features/events/queries';
import {
  canCompose,
  captionFromPieces,
  pieceBoundsLine,
  titleFromPieces,
} from '@/features/share-look/compose';
import { useComposeAndPostLook, useSwapLookPieces } from '@/features/share-look/mutations';
import { useWardrobe } from '@/features/styling/queries';
import type { Garment } from '@/lib/styling';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

type Step = 1 | 2 | 3;

/** "Sat, Aug 8" — the atlas's date line, on the event's own start time. */
function shortDateLine(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Share a Look — S-01…S-03, one screen, three steps.
 *
 * Rebuilt entirely from the picking-an-existing-outfit flow it used to be:
 * this composes a FRESH stack straight from the closet, in the order it will
 * post, and only touches `outfits`/`outfit_items` once, at the end
 * (`useComposeAndPostLook`). Every field a step collects lives in this
 * component's own state and none of it is cleared on a failed write — "It
 * didn't post" (S-05) reuses the exact same state the next attempt sends.
 *
 * `?edit=<postId>` is the "Swap a piece" entry point (S-05): the stack starts
 * from that look's current garments and the last step calls
 * `useSwapLookPieces` in place of a fresh post — the look stays the same
 * look, just re-composed.
 */
export default function PostLookScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const eventId = id ?? null;
  const router = useRouter();
  const theme = useTheme();

  const event = useEvent(eventId);
  const members = useEventMembers(eventId ?? '');
  const wardrobe = useWardrobe();
  const posts = useEventPosts(eventId);
  const terms = useSocialTermsGate();

  const postLook = useComposeAndPostLook();
  const swapPieces = useSwapLookPieces();

  const editingLook = edit ? (posts.data?.looks ?? []).find((l) => l.id === edit) ?? null : null;

  const [step, setStep] = useState<Step>(edit ? 2 : 1);
  const [stack, setStack] = useState<Garment[]>([]);
  const [hydratedEdit, setHydratedEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [titleEdited, setTitleEdited] = useState(false);
  const [caption, setCaption] = useState('');
  const [captionEdited, setCaptionEdited] = useState(false);
  const [saveToLately, setSaveToLately] = useState(true);
  const [failed, setFailed] = useState(false);
  const [plateWidth, setPlateWidth] = useState(0);
  /**
   * Correction 27's seventh tap. Cleared on the next successful change rather
   * than on a timer: a refusal that faded on its own would be a delayed
   * dismissal, which the constitution refuses, and the message is only
   * meaningful for as long as the stack is still full.
   */
  const [refused, setRefused] = useState(false);
  /**
   * Largest Dynamic Type — SL-01 / AX.
   *
   * Read from the real system font scale, not a prop and not a fixture flag:
   * `useWindowDimensions().fontScale` is what iOS reports for the user's own
   * setting, so the two-column grid and the 138 pt bar arrive when the type
   * actually grows rather than when someone remembers to pass a boolean.
   */
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= 1.5;

  // Hydrate the stack from the look being edited once its garments are known
  // (garments arrive from the board query, not this screen's own wardrobe
  // read, since a piece may have left the closet since the look was posted).
  //
  // Adjusted DURING RENDER rather than in an effect. React sanctions this shape
  // for "a prop changed, derive new state from it": the re-render happens before
  // anything is committed, so the user never sees the un-hydrated frame. The
  // effect version painted an empty stack first and then replaced it, which is
  // both an extra pass and a visible flash on a slow board query.
  if (editingLook && !hydratedEdit) {
    setStack(editingLook.garments);
    setTitle(editingLook.caption ?? titleFromPieces(editingLook.garments));
    setHydratedEdit(true);
  }

  const candidates = wardrobe.data ?? [];

  const { resolve } = useSignedUrls(
    candidates.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]),
  );

  // The 1–3-looks-per-board cap is presentation only (product-spec §3.4's
  // screen stops offering the CTA; the schema carries no such constraint), so
  // it applies to fresh posts and never blocks editing a look already on the
  // board.
  const atCap = !editingLook && (posts.data?.looks ?? []).length >= MAX_LOOKS_PER_BOARD;
  const peopleCount = (members.data ?? []).filter((m) => m.state === 'joined').length;

  const goToStep2 = () => setStep(2);

  const goToStep3 = () => {
    if (!titleEdited) setTitle(titleFromPieces(stack));
    if (!captionEdited) setCaption(captionFromPieces(stack));
    setStep(3);
  };

  const submit = () => {
    if (!eventId) return;
    setFailed(false);
    const itemIds = stack.map((g) => g.id);
    const finalTitle = title.trim() ? title.trim() : null;
    const finalCaption = caption.trim() ? caption.trim() : null;

    if (editingLook) {
      swapPieces.mutate(
        { eventId, outfitId: editingLook.outfitId, itemIds, title: finalTitle },
        {
          onSuccess: () => router.back(),
          onError: (error) => {
            if (terms.intercept(error, submit)) return;
            setFailed(true);
          },
        },
      );
      return;
    }

    postLook.mutate(
      { eventId, itemIds, title: finalTitle, caption: finalCaption, saveToLately },
      {
        onSuccess: ({ postId }) => {
          // Lands back on the board, not a success screen (S-04) — the board
          // owns scrolling to the new card and decaying its "Just posted" mark.
          router.replace({
            pathname: '/event/[id]/outfits',
            params: { id: eventId, justPosted: postId },
          });
        },
        onError: (error) => {
          if (terms.intercept(error, submit)) return;
          setFailed(true);
        },
      },
    );
  };

  const pending = postLook.isPending || swapPieces.isPending;
  const loading = event.isLoading || wardrobe.isLoading || (Boolean(edit) && posts.isLoading);
  const errored = event.isError || wardrobe.isError;
  const retry = () => {
    void event.refetch();
    void wardrobe.refetch();
    void posts.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <WizardHeader
        step={step}
        editing={Boolean(editingLook)}
        canAdvance={step === 1 ? canCompose(stack) : true}
        submitting={pending}
        onBack={() => {
          if (step === 1) router.back();
          else setStep((s) => (s === 3 ? 2 : 1) as Step);
        }}
        onNext={() => {
          if (step === 1) goToStep2();
          else if (step === 2) goToStep3();
          else submit();
        }}
      />

      {errored ? (
        <ErrorState
          title="Your closet didn’t load"
          body="Your pieces are still there — the connection dropped on the way."
          onRetry={retry}
        />
      ) : loading ? (
        <View className="px-gutter pt-5" accessibilityLabel="Reading your closet">
          <Skeleton className="h-9 w-3/4 rounded-md" />
          <View className="mt-6 flex-row flex-wrap" style={{ marginHorizontal: -5 }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ width: '33.333%', padding: 5 }}>
                <Skeleton className="aspect-square rounded-md" />
              </View>
            ))}
          </View>
        </View>
      ) : candidates.length === 0 && !editingLook ? (
        <View className="px-gutter pt-6">
          <EmptyClosetPrompt onAddPiece={() => router.push('/add-clothes')} />
        </View>
      ) : failed ? (
        <View className="px-gutter pt-6">
          <FailedDraftBanner
            retrying={pending}
            pieceCount={stack.length}
            hasCaption={caption.trim().length > 0}
            onRetry={submit}
            onKeepDraft={() => setFailed(false)}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <KeyboardAwareScrollView contentContainerClassName="px-gutter pb-10 pt-5">
            {atCap ? (
              <Card border="hairline" padding="md" className="mb-4">
                <Text variant="noteSmall">
                  Three looks is the board’s limit — retire one first to share another.
                </Text>
              </Card>
            ) : null}

            {step === 1 ? (
              <>
                <Text variant="title" trim>
                  What are you wearing?
                </Text>
                <Text variant="body" className="mt-2.5 text-muted">
                  {pieceBoundsLine()}.
                </Text>
                <View className="mt-4">
                  <PiecePicker
                    candidates={candidates}
                    stack={stack}
                    resolveImage={resolve}
                    ax={ax}
                    onChangeStack={(next) => {
                      setRefused(false);
                      setStack(next);
                    }}
                    onRefused={() => setRefused(true)}
                  />
                </View>
              </>
            ) : step === 2 ? (
              <>
                <Text variant="title" trim>
                  The stack
                </Text>
                <Text variant="body" className="mt-2.5 text-muted">
                  Drag to reorder. Top piece first — that’s what shows on the board.
                </Text>
                <View className="mt-4" onLayout={(e) => setPlateWidth(e.nativeEvent.layout.width)}>
                  {stack.length > 0 && plateWidth > 0 ? (
                    <StackComposer
                      stack={stack}
                      resolveImage={resolve}
                      plateWidth={plateWidth}
                      onReorder={setStack}
                      onAddAnother={() => setStep(1)}
                    />
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text variant="title" trim>
                  Say what it is
                </Text>
                <Text variant="body" className="mt-2.5 text-muted">
                  A name and a line. Both optional — the pieces already say most of it.
                </Text>
                <View className="mt-4">
                  <CaptionStep
                    stack={stack}
                    resolveImage={resolve}
                    title={title}
                    onChangeTitle={(t) => {
                      setTitleEdited(true);
                      setTitle(t);
                    }}
                    caption={caption}
                    onChangeCaption={(t) => {
                      setCaptionEdited(true);
                      setCaption(t);
                    }}
                    eventTitle={event.data?.title ?? 'This event'}
                    eventDateLine={shortDateLine(event.data?.startsAt ?? null)}
                    peopleCount={peopleCount}
                    saveToLately={saveToLately}
                    onChangeSaveToLately={setSaveToLately}
                  />
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={editingLook ? 'Save changes' : 'Post to the board'}
                  accessibilityState={{ disabled: pending || atCap }}
                  disabled={pending || atCap}
                  onPress={submit}
                  style={{ minHeight: 52, opacity: pending || atCap ? 0.4 : 1 }}
                  className="mt-6 items-center justify-center rounded-md bg-ink active:opacity-80">
                  <Text variant="body" className="font-semibold" style={{ color: theme.canvas }}>
                    {pending ? 'Posting…' : editingLook ? 'Save changes' : 'Post to the board'}
                  </Text>
                </Pressable>
              </>
            )}
          </KeyboardAwareScrollView>

          {step === 1 ? (
            <View className="px-gutter">
              <PickerFooterTray
                stack={stack}
                resolveImage={resolve}
                canCompose={canCompose(stack)}
                refused={refused}
                ax={ax}
                onCompose={goToStep2}
              />
            </View>
          ) : null}
        </View>
      )}

      {terms.sheet}
    </SafeAreaView>
  );
}

function WizardHeader({
  step,
  editing,
  canAdvance,
  submitting,
  onBack,
  onNext,
}: {
  step: Step;
  editing: boolean;
  canAdvance: boolean;
  submitting: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const theme = useTheme();
  const nextLabel = step === 3 ? (editing ? 'Save' : 'Post') : 'Next';
  const disabled = step === 1 ? !canAdvance : submitting;

  return (
    <View
      className="flex-row items-center justify-between px-gutter pt-2"
      style={{ minHeight: MIN_TAP_TARGET }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={step === 1 ? 'Cancel' : 'Back'}
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        className="active:opacity-60">
        <Text variant="body" style={{ color: theme.muted }}>
          {step === 1 ? 'Cancel' : 'Back'}
        </Text>
      </Pressable>

      <Text variant="colophon">{`Step ${step} of 3`}</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onNext}
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        className="active:opacity-60"
        style={{ opacity: disabled ? 0.4 : 1 }}>
        <Text
          variant="body"
          className="font-semibold"
          style={{ color: step === 3 ? theme.accent : theme.ink }}>
          {nextLabel}
        </Text>
      </Pressable>
    </View>
  );
}
