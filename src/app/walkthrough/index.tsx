import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelMeter } from '@/components/intake/LevelMeter';
import { unmatchedTranscriptSpans } from '@/components/intake/Precipitate';
import { FailureScreen, type WalkthroughFailure } from '@/components/intake/FailureScreen';
import { ReadingBack } from '@/components/intake/ReadingBack';
import {
  ConsentLine,
  SpokenExamples,
  WalkthroughBand,
  WalkthroughChrome,
} from '@/components/intake/walkthrough-parts';
import { Button, Text } from '@/components/ui';
import {
  CHIP,
  recordingStateLabel,
  recordingSupportLine,
  TYPE,
} from '@/features/intake/walkthrough-spec';
import {
  intakeParsed,
  intakeRecordingFinished,
  intakeStarted,
} from '@/features/intake/analytics';
import {
  HEARD,
  heardChips,
  heardHeadline,
  SLOW_NOTICE_AFTER_MS,
  unmatchedTitle,
  WALKTHROUGH_INVITATION,
} from '@/features/intake/walkthrough-copy';
import { kindOfSlot } from '@/features/closet/outfit-count';
import { useParseCloset } from '@/features/intake/use-parse';
import { MAX_RECORDING_MS, useRecorder } from '@/features/intake/use-recorder';
import { needsNewRecording, useTranscription } from '@/features/intake/use-transcription';
import { getUserId, supabase } from '@/lib/supabase';
import type { IntakeDraftRow } from '@/features/intake/queries';

/**
 * The Walkthrough — V-01, V-02, V-03, V-04, V-05 and the four V-13 branches.
 *
 * One route rather than five, because these are phases of a single continuous
 * act and routing between them would put a back button in the middle of a
 * recording. The screen the user is on is derived from `phase`, and the only
 * navigation out is forward to the review procession or sideways to The Ten.
 *
 * WHY THE ORDER OF `phase` MATTERS
 *
 * `failed` is a phase, not a modal. V-13 insists on four distinct causes with
 * four distinct screens and four distinct actions — "never one generic
 * failure" — so the failure carries the cause with it and the screen branches
 * on it rather than showing a shared error card with different copy.
 */

type Phase =
  | 'invitation' // V-01
  | 'listening' // V-02 + V-03
  | 'reading' // V-04
  | 'heard' // V-05
  | 'failed'; // V-13

/**
 * The V-13 causes, kept apart on purpose.
 *
 * `signed_out` is a fifth the directive's table does not list, and it exists
 * because the first simulator walk found the failure it describes: with no
 * session, `begin()` returned silently after the microphone prompt and left
 * the user tapping Start against a screen that never changed. The directive's
 * rule — "four distinct causes, four distinct screens, never one generic
 * failure" — is really a rule about never failing without a name, so a fifth
 * named cause is the fix rather than an exception to it.
 */
type Failure = WalkthroughFailure;

/** V-03 cycles these after 25s of quiet, in slot order. */
const NUDGES = ['Tops?', 'Bottoms?', 'Dresses?', 'Shoes?', 'A coat?', 'Bags?'];
const NUDGE_AFTER_MS = 25_000;

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function WalkthroughScreen() {
  const router = useRouter();
  const recorder = useRecorder();
  const transcribe = useTranscription();
  const parse = useParseCloset();

  const [phase, setPhase] = useState<Phase>('invitation');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [transcript, setTranscript] = useState('');
  const [drafts, setDrafts] = useState<IntakeDraftRow[]>([]);
  const [parseComplete, setParseComplete] = useState(false);
  const [capped, setCapped] = useState(false);
  const sessionId = useRef<string | null>(null);
  /** The take's measured length — V-04's headline and V-13d's body read it. */
  const [durationMs, setDurationMs] = useState<number | null>(null);
  /**
   * V-04's slow notice, at twelve seconds. Held here rather than inside
   * `ReadingBack` so the notice is a prop the component can be photographed in
   * both states with, and so the timer dies with the phase rather than with a
   * subtree that may re-mount.
   */
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (phase !== 'reading') {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), SLOW_NOTICE_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase]);

  /** V-03's index, advanced only while the nudge is showing. */
  const [nudge, setNudge] = useState(0);
  const showNudge = phase === 'listening' && recorder.silentForMs > NUDGE_AFTER_MS;
  useEffect(() => {
    if (!showNudge) return;
    const t = setInterval(() => setNudge((n) => (n + 1) % NUDGES.length), 4000);
    return () => clearInterval(t);
  }, [showNudge]);

  // Named, so the offline retry below can call it — see the note on `post` in
  // `use-comment-thread.tsx`. Referring to the `begin` const from inside its own
  // initialiser reads the binding while it is still in its temporal dead zone;
  // it works only because the retry thunk runs later, and the compiler is right
  // not to accept that.
  const begin = useCallback(async function begin() {
    const granted =
      recorder.permission === 'granted' ? 'granted' : await recorder.requestPermission();
    if (granted !== 'granted') {
      setFailure({ cause: 'denied' });
      setPhase('failed');
      return;
    }

    const userId = await getUserId();
    if (!userId) {
      // Never a bare return. See the `signed_out` note on `Failure`.
      setFailure({ cause: 'signed_out' });
      setPhase('failed');
      return;
    }

    // The session row exists before the microphone opens, so a recording can
    // never be orphaned from the row that owns its storage path.
    const { data, error } = await supabase
      .from('intake_sessions')
      .insert({ user_id: userId, status: 'recording' })
      .select('id')
      .single();
    if (error || !data) {
      setFailure({ cause: 'offline', retry: () => void begin() });
      setPhase('failed');
      return;
    }

    sessionId.current = data.id;
    intakeStarted();
    await recorder.start();
    setPhase('listening');
  }, [recorder]);

  /**
   * The one path out of V-02. Every stop reason lands here — the user's Done,
   * the twelve-minute cap, and a backgrounding — because all three produce
   * audio that must be transcribed rather than discarded.
   */
  const finish = useCallback(async () => {
    const result = await recorder.stop('user');
    const id = sessionId.current;
    if (!result || !id) {
      setFailure({ cause: 'silent' });
      setPhase('failed');
      return;
    }

    setCapped(result.reason === 'capped');
    setDurationMs(result.durationMs);
    intakeRecordingFinished(result.durationMs);
    setPhase('reading');

    const run = () => {
      transcribe.mutate(
        { sessionId: id, localUri: result.uri, durationMs: result.durationMs },
        {
          onSuccess: ({ transcript: text }) => {
            setTranscript(text);
            parse.mutate(
              { sessionId: id },
              {
                onSuccess: ({ drafts: rows, unconsumed }) => {
                  intakeParsed(rows.length, unconsumed.length);
                  setDrafts(rows);
                  setParseComplete(true);
                  if (rows.length === 0) {
                    setFailure({ cause: 'unparsed', transcript: text });
                    setPhase('failed');
                  }
                },
                onError: () => {
                  setFailure({ cause: 'offline', retry: run });
                  setPhase('failed');
                },
              },
            );
          },
          onError: (err) => {
            // `silent` and `too_large` cannot be retried with the same take —
            // the identical failure would repeat — so they ask for a new one.
            setFailure(
              needsNewRecording(err.failure) ? { cause: 'silent' } : { cause: 'offline', retry: run },
            );
            setPhase('failed');
          },
        },
      );
    };
    run();
  }, [recorder, transcribe, parse]);

  const toReview = useCallback(() => {
    if (sessionId.current) router.replace(`/walkthrough/review?session=${sessionId.current}`);
  }, [router]);

  /**
   * The named exit redesign 24 draws in every frame's chrome.
   *
   * IT DISCARDS NOTHING, which is the only reason it is allowed to exist as a
   * pure navigation. It is the same "Leave it for later" the offline failure
   * already offers, and it rests on the same shipped contract: the session row
   * and its drafts are server-side and resumable, the recording stays on the
   * phone, and TR-06 draws the unfinished walkthrough as a card to come back
   * to. Nothing is stopped, cancelled or deleted on the way out.
   *
   * `back()` where there is somewhere to go back to — the reader arrived here
   * from Add clothes or The Ten and expects to land there — and the tab root
   * otherwise, so a cold deep link cannot leave them on a dead screen.
   */
  const leaveForLater = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  // ── V-13 ────────────────────────────────────────────────────────────────
  if (phase === 'failed' && failure) {
    return (
      <FailureScreen
        failure={failure}
        durationMs={durationMs}
        // `?door=photograph` — this reader has just chosen the camera, so The
        // Ten must not open on TR-05 and ask them which door they want.
        onPhotograph={() => router.replace('/the-ten?door=photograph')}
        onRetake={() => {
          setFailure(null);
          setTranscript('');
          setDrafts([]);
          setParseComplete(false);
          setDurationMs(null);
          sessionId.current = null;
          setPhase('invitation');
        }}
        onSignIn={() => router.replace('/(auth)/sign-in')}
        // "Leave it for later" — the session stays resumable and the recording
        // stays on the phone. Nothing is discarded on the way out; this is the
        // other end of TR-06's promise.
        onLeaveForLater={() => router.replace('/(tabs)')}
      />
    );
  }

  // ── V-02 / V-03 ─────────────────────────────────────────────────────────
  //
  // NO EXIT IN THE CHROME, and this is the one place redesign 24's frames draw
  // a control that is not built. Every other phase's "Cancel" is lossless — the
  // session is resumable and the recording is on the phone, which is TR-06's
  // own promise — but a Cancel here would have to answer "and the audio?", and
  // the only honest answers are discard it (a deletion this flow has nowhere
  // else) or keep it (which is what Done already does). Adding it would be a
  // recording-lifecycle change wearing a chrome change's clothes. The frame's
  // deviation is recorded rather than guessed at.
  if (phase === 'listening') {
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <WalkthroughChrome state={recordingStateLabel(recorder.isPaused)} />

          {/* The elapsed figure is the frame's hero and it is LEADING, not
              centred: it reads as a measurement the page is taking, which is
              what it is. Tabular so the digits do not dance. No `trim` — the
              serif variants' cap-trim table is computed at each variant's own
              size, and applying `display`'s 40pt trim to a 58pt glyph is the
              clipping bug that table exists to prevent. */}
          <View className="px-gutter" style={{ marginTop: 8 }}>
            <Text
              variant="display"
              accessibilityLiveRegion="polite"
              style={{
                fontSize: TYPE.timer,
                lineHeight: Math.round(TYPE.timer * TYPE.timerLeading),
                fontVariant: ['tabular-nums'],
              }}>
              {clock(recorder.elapsedMs)}
            </Text>
          </View>

          <View className="items-center" style={{ marginTop: 22 }}>
            <LevelMeter amplitude={recorder.amplitude} active={!recorder.isPaused} />
          </View>

          {/* Fact, not encouragement, and it changes with the recorder rather
              than with anything that was heard — nothing has been read yet. */}
          <View className="px-gutter" style={{ marginTop: 22 }}>
            <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
              {recordingSupportLine(recorder.isPaused)}
            </Text>
          </View>

          {showNudge ? (
            // V-03, in the group's band rather than as a floating word. Tray
            // and `polite`: it is additive and it is never a failure.
            <View className="px-gutter" style={{ marginTop: 16 }}>
              <WalkthroughBand body={NUDGES[nudge]!} />
            </View>
          ) : null}

          <View style={{ flex: 1 }} />

          <View className="px-gutter" style={{ gap: 10 }}>
            <Button title="Done" onPress={() => void finish()} haptic className="self-stretch" />
            <Button
              title={recorder.isPaused ? 'Resume' : 'Pause'}
              variant="secondary"
              onPress={recorder.isPaused ? recorder.resume : recorder.pause}
              haptic
              className="self-stretch"
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── V-04 ────────────────────────────────────────────────────────────────
  if (phase === 'reading') {
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <WalkthroughChrome
            exit={{
              label: 'Cancel',
              onPress: leaveForLater,
              hint: 'Leaves this running. The list will be waiting.',
            }}
          />
          <ReadingBack
            durationMs={durationMs}
            slow={slow}
            // The notice is information, not a control: acknowledging it leaves
            // the wait exactly where it was. Nothing is cancelled, because
            // there is nothing here worth cancelling.
            onLeaveRunning={() => setSlow(false)}
          />
          {/* The parse settles the phase. `Precipitate`'s staged reveal was the
              old treatment of this beat; V-04 replaces it with a skeleton that
              matches the cards it is about to become. */}
          <SettleWhenParsed complete={parseComplete} onSettled={() => setPhase('heard')} />
        </SafeAreaView>
      </View>
    );
  }

  // ── V-05 ────────────────────────────────────────────────────────────────
  if (phase === 'heard') {
    const missed = unmatchedTranscriptSpans(transcript, drafts);
    const missedTitle = unmatchedTitle(missed.length);
    const chips = heardChips(tallyDrafts(drafts));
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <WalkthroughChrome
            exit={{
              label: 'Cancel',
              onPress: leaveForLater,
              hint: 'Leaves the list for later. Nothing is discarded.',
            }}
          />
          <ScrollView contentContainerClassName="px-gutter pb-4" style={{ flex: 1 }}>
            <Text variant="eyebrow">{HEARD.eyebrow}</Text>
            <View style={{ marginTop: 6, marginBottom: 12 }}>
              <Text variant="display" trim accessibilityRole="header">
                {heardHeadline(drafts.length)}
              </Text>
            </View>
            {/* The principle, verbatim, and the sentence that says what the
                chips are BEFORE the numbers are read: counts of what was heard,
                not of what will be kept. */}
            <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
              {HEARD.body}
            </Text>

            <View className="flex-row flex-wrap" style={{ marginTop: 20, gap: 8 }}>
              {chips.map((chip) => (
                <View
                  key={chip}
                  className="bg-tray"
                  style={{
                    borderRadius: CHIP.radius,
                    paddingHorizontal: CHIP.paddingHorizontal,
                    paddingVertical: CHIP.paddingVertical,
                  }}>
                  <Text variant="body" style={{ fontSize: 15 }}>
                    {chip}
                  </Text>
                </View>
              ))}
            </View>

            {capped ? (
              // Blush, because the cap is the reason the list stops where it
              // does and that is worth a beat. Still a fact and still not a
              // failure: everything spoken up to it was kept.
              <WalkthroughBand
                tone="blush"
                title="Twelve minutes read"
                body="The recording reached its twelve-minute limit. Everything up to it was kept."
                style={{ marginTop: 20 }}
              />
            ) : null}

            {missedTitle ? (
              // Named as KEPT, never silently discarded — the same rule the
              // rejection state relies on.
              <WalkthroughBand
                title={missedTitle}
                body={HEARD.unmatchedBody}
                style={{ marginTop: 20 }}
              />
            ) : null}
          </ScrollView>
          <View className="px-gutter">
            <Button title={HEARD.action} onPress={toReview} haptic className="self-stretch" />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── V-01 ────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <WalkthroughChrome
          exit={{ label: 'Cancel', onPress: leaveForLater, hint: 'Nothing has been recorded' }}
        />
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <Text variant="eyebrow">{WALKTHROUGH_INVITATION.eyebrow}</Text>
          <View style={{ marginTop: 6, marginBottom: 12 }}>
            <Text variant="display" trim accessibilityRole="header">
              {WALKTHROUGH_INVITATION.headline}
            </Text>
          </View>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {WALKTHROUGH_INVITATION.body}
          </Text>
          {/* THE SPECIMEN IS THE BODY OF THIS FRAME. Redesign 24 pushes the
              three examples to serif italic at reading-plus scale and drops the
              rule that used to fence them off — with the examples at this size
              the rule was separating the page from its own subject. See
              `SpokenExamples` for why they stay prose and never become chips. */}
          <View style={{ marginTop: 24 }}>
            <SpokenExamples examples={WALKTHROUGH_INVITATION.examples} />
          </View>
        </ScrollView>
        <View className="px-gutter">
          {/* One line, directly above the action, because the tap is the moment
              it is acted on. The system permission prompt follows it and is the
              actual request — this no longer describes it in advance. Verbatim,
              whole, and the only copy of this sentence in the product. */}
          <ConsentLine text={WALKTHROUGH_INVITATION.consent} />
          <Button
            title={WALKTHROUGH_INVITATION.action}
            onPress={() => void begin()}
            haptic
            className="self-stretch"
          />
          <View style={{ marginTop: 10 }}>
            {/* Secondary, not ghost: the frames draw the photograph door as a
                filled tray control the same width as the record action. It is
                the other real door, not a footnote under one. */}
            <Button
              title={WALKTHROUGH_INVITATION.secondary}
              variant="secondary"
              onPress={() => router.replace('/the-ten?door=photograph')}
              className="self-stretch"
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * The phase advance, isolated so `ReadingBack` never has to know it is inside a
 * state machine. Renders nothing.
 */
function SettleWhenParsed({ complete, onSettled }: { complete: boolean; onSettled: () => void }) {
  useEffect(() => {
    if (complete) onSettled();
  }, [complete, onSettled]);
  return null;
}

/**
 * Counts of what was heard, in the kinds the chips name.
 *
 * ONE PER CARD, deliberately, not per `quantity`. These are counts of what was
 * HEARD — phrases — and an ambiguous plural is still one phrase until the
 * stepper answers it. Counting the model's guess at "a few" here would print a
 * number nobody said, which is the one thing this whole screen is arranged to
 * avoid. It also keeps the chips summing to the headline's own figure.
 *
 * `kindOfSlot` collapses the engine's seven slots into the four counted kinds,
 * so `base_top` and `mid_layer` both read as tops — the chip has to say what a
 * person would say. Outerwear and bags pass through by name.
 */
function tallyDrafts(drafts: readonly IntakeDraftRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const d of drafts) {
    const slot = d.slot as Parameters<typeof kindOfSlot>[0];
    const key = kindOfSlot(slot) ?? slot;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * V-13. Four causes, four screens — the table in §3, not a shared error card.
 *
 * The `unparsed` branch shows the transcript in full. That is the row the
 * directive singles out: showing the words proves the app heard them and
 * locates the fault honestly, where swallowing it makes the app look broken
 * and unaccountable.
 */
void MAX_RECORDING_MS;
