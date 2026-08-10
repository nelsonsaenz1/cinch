import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LevelMeter } from '@/components/intake/LevelMeter';
import { Precipitate, unmatchedTranscriptSpans } from '@/components/intake/Precipitate';
import { Button, Chip, Text } from '@/components/ui';
import {
  intakeParsed,
  intakeRecordingFinished,
  intakeStarted,
} from '@/features/intake/analytics';
import { useParseCloset } from '@/features/intake/use-parse';
import { MAX_RECORDING_MS, useRecorder } from '@/features/intake/use-recorder';
import { needsNewRecording, useTranscription } from '@/features/intake/use-transcription';
import { supabase } from '@/lib/supabase';
import { getUserId } from '@/lib/supabase';
import { useTheme } from '@/theme/tokens';
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

/** The four V-13 causes, kept apart on purpose. */
type Failure =
  | { cause: 'denied' }
  | { cause: 'silent' }
  | { cause: 'unparsed'; transcript: string }
  | { cause: 'offline'; retry: () => void };

/** V-01's teaching device. Deliberately imperfect phrasing. */
const EXAMPLES = ['"white linen shirt"', '"those brown loafers"', '"a heavy grey coat"'];

/** V-03 cycles these after 25s of quiet, in slot order. */
const NUDGES = ['Tops?', 'Bottoms?', 'Dresses?', 'Shoes?', 'A coat?', 'Bags?'];
const NUDGE_AFTER_MS = 25_000;

function clock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function WalkthroughScreen() {
  const router = useRouter();
  const theme = useTheme();
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

  /** V-03's index, advanced only while the nudge is showing. */
  const [nudge, setNudge] = useState(0);
  const showNudge = phase === 'listening' && recorder.silentForMs > NUDGE_AFTER_MS;
  useEffect(() => {
    if (!showNudge) return;
    const t = setInterval(() => setNudge((n) => (n + 1) % NUDGES.length), 4000);
    return () => clearInterval(t);
  }, [showNudge]);

  const begin = useCallback(async () => {
    const granted =
      recorder.permission === 'granted' ? 'granted' : await recorder.requestPermission();
    if (granted !== 'granted') {
      setFailure({ cause: 'denied' });
      setPhase('failed');
      return;
    }

    const userId = await getUserId();
    if (!userId) return;

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

  // ── V-13 ────────────────────────────────────────────────────────────────
  if (phase === 'failed' && failure) {
    return <FailureScreen failure={failure} onPhotograph={() => router.replace('/the-ten')} />;
  }

  // ── V-02 / V-03 ─────────────────────────────────────────────────────────
  if (phase === 'listening') {
    return (
      <View className="flex-1 bg-canvas" style={{ justifyContent: 'center' }}>
        <SafeAreaView edges={['bottom']}>
          <LevelMeter amplitude={recorder.amplitude} active={!recorder.isPaused} />
          <View className="items-center" style={{ marginTop: 28 }}>
            <Text variant="display" style={{ fontVariant: ['tabular-nums'] }}>
              {clock(recorder.elapsedMs)}
            </Text>
          </View>
          {showNudge ? (
            <View className="items-center" style={{ marginTop: 10 }}>
              <Text variant="body" className="text-muted">
                {NUDGES[nudge]}
              </Text>
            </View>
          ) : null}
          <View className="px-gutter flex-row gap-3" style={{ marginTop: 44 }}>
            <View className="flex-1">
              <Button
                title={recorder.isPaused ? 'Resume' : 'Pause'}
                variant="secondary"
                onPress={recorder.isPaused ? recorder.resume : recorder.pause}
                haptic
              />
            </View>
            <View className="flex-1">
              <Button title="Done" onPress={() => void finish()} haptic />
            </View>
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
          <Precipitate
            transcript={transcript}
            garments={drafts}
            isComplete={parseComplete}
            onSettled={() => setPhase('heard')}
          />
        </SafeAreaView>
      </View>
    );
  }

  // ── V-05 ────────────────────────────────────────────────────────────────
  if (phase === 'heard') {
    const missed = unmatchedTranscriptSpans(transcript, drafts);
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
            <View style={{ marginBottom: 10 }}>
              <Text variant="display">{spellCount(drafts.length)}</Text>
            </View>
            <Text variant="body" className="text-muted">
              Let&rsquo;s check them. It&rsquo;s quick — tap through, fix anything wrong.
            </Text>
            {capped ? (
              <View style={{ marginTop: 18 }}>
                <Text variant="body" className="text-muted">
                  That&rsquo;s plenty for now. You can add more after.
                </Text>
              </View>
            ) : null}
            {missed.length > 0 ? (
              <View style={{ marginTop: 26 }}>
                <Text variant="caption" className="text-muted">
                  {missed.length === 1
                    ? 'One thing I didn’t catch'
                    : `${missed.length} things I didn’t catch`}
                </Text>
                {missed.map((span, i) => (
                  <View key={`${span}-${i}`} style={{ marginTop: 8 }}>
                    <Text variant="body" className="text-muted">
                      {span}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
          <View className="px-gutter">
            <Button title="Check them" onPress={toReview} haptic />
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── V-01 ────────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <View style={{ marginBottom: 14 }}>
            <Text variant="display">Walk your closet. Talk.</Text>
          </View>
          <Text variant="body" className="text-muted">
            Say what you own as you go — the colour, the fabric, roughly what it is. &ldquo;Navy
            wool crewneck.&rdquo; &ldquo;Black ankle boots.&rdquo; Don&rsquo;t tidy it up; you can
            fix anything after.
          </Text>
          <View className="flex-row flex-wrap gap-2" style={{ marginTop: 22 }}>
            {EXAMPLES.map((e) => (
              <Chip key={e} label={e} />
            ))}
          </View>
        </ScrollView>
        <View className="px-gutter">
          {/* Non-optional, per §8. It sits directly above the action because
              that is the moment consent is actually given. */}
          <View style={{ marginBottom: 12 }}>
            <Text variant="caption" className="text-muted">
              The recording is transcribed and deleted. Cinch keeps the words, never the audio.
            </Text>
          </View>
          <Button title="Start" onPress={() => void begin()} haptic />
          <View className="items-center" style={{ marginTop: 14 }}>
            <Text
              variant="body"
              className="text-muted"
              accessibilityRole="button"
              onPress={() => router.replace('/the-ten')}>
              Photograph instead
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * V-13. Four causes, four screens — the table in §3, not a shared error card.
 *
 * The `unparsed` branch shows the transcript in full. That is the row the
 * directive singles out: showing the words proves the app heard them and
 * locates the fault honestly, where swallowing it makes the app look broken
 * and unaccountable.
 */
function FailureScreen({ failure, onPhotograph }: { failure: Failure; onPhotograph: () => void }) {
  const copy = {
    denied: 'Cinch needs the microphone to hear you.',
    silent: 'I didn’t catch anything.',
    unparsed: 'I heard you, but I couldn’t find any clothes in it.',
    offline: 'I can’t reach the transcriber. Your recording is safe.',
  }[failure.cause];

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1 }}>
          <View style={{ marginBottom: 12 }}>
            <Text variant="display">{copy}</Text>
          </View>
          {failure.cause === 'unparsed' ? (
            <Text variant="body" className="text-muted">
              {failure.transcript}
            </Text>
          ) : null}
        </ScrollView>
        <View className="px-gutter gap-3">
          {failure.cause === 'denied' ? (
            <Button title="Open Settings" onPress={() => void Linking.openSettings()} haptic />
          ) : null}
          {failure.cause === 'offline' ? (
            <Button title="Retry" onPress={failure.retry} haptic />
          ) : null}
          {failure.cause === 'silent' || failure.cause === 'unparsed' ? (
            <Button title="Try again" onPress={onPhotograph} haptic />
          ) : null}
          <View className="items-center">
            <Text
              variant="body"
              className="text-muted"
              accessibilityRole="button"
              onPress={onPhotograph}>
              Photograph instead
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** V-05's count is spoken, not numeric — "Twenty-three pieces." */
function spellCount(n: number): string {
  const words = [
    'No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
    'Nineteen', 'Twenty',
  ];
  const word = n <= 20 ? words[n] : String(n);
  return `${word} ${n === 1 ? 'piece' : 'pieces'}.`;
}

void MAX_RECORDING_MS;
