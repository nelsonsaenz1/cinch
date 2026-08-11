import {
  AudioModule,
  RecordingPresets,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

/**
 * The recorder behind V-02.
 *
 * Wraps `expo-audio` with the four behaviours the directive asks for and that
 * nothing in the library gives you for free: a permission answer the screen can
 * branch on, an amplitude stream the seismograph can animate from, a hard stop
 * at twelve minutes, and the backgrounding rule.
 *
 * WHY THE AMPLITUDE IS A SHARED VALUE AND NOT REACT STATE
 *
 * V-02 draws ~48 strokes whose heights follow the input level, updated about
 * thirty times a second, on a screen someone stares at for four minutes.
 * Routing that through `useState` is ~30 React renders a second for the whole
 * subtree, which drops frames on exactly the screen that has to look calm.
 *
 * So the poll writes into a Reanimated shared value and the meter reads it on
 * the UI thread. The poll itself has to run on the JS thread — `getStatus()` is
 * a synchronous call into the native module and there is no worklet-side
 * equivalent — but writing a shared value is cheap and, crucially, does not
 * re-render anything. `elapsedMs` IS state, because it changes once a second
 * and a serif clock re-rendering at 1Hz costs nothing.
 *
 * WHY METERING IS NORMALISED HERE RATHER THAN IN THE METER
 *
 * iOS reports metering in dBFS: roughly -160 (silence) to 0 (clipping), a
 * logarithmic scale where normal speech sits around -20 and the bottom half of
 * the range is inaudible. A component that mapped that linearly to stroke
 * height would draw a flat line with occasional spikes. The curve below is the
 * honest part of the range, expanded — and it belongs here, next to the units
 * it converts, rather than in a drawing component that should not have to know
 * what a decibel is.
 */

/** The abuse ceiling and the UX ceiling, and they are the same number (§9). */
export const MAX_RECORDING_MS = 12 * 60 * 1000;

/** ~30Hz. Fast enough to look continuous, slow enough to be free. */
const METER_INTERVAL_MS = 33;

/** The clock only needs to be right to the second it displays. */
const CLOCK_INTERVAL_MS = 250;

/**
 * Quietest level the meter will draw as movement.
 *
 * Below about -50 dBFS is room tone — a fridge, traffic, the phone's own
 * handling noise. Drawing it would make the meter twitch while nobody is
 * speaking, which reads as "it is hearing something" when it is not.
 */
const FLOOR_DB = -50;

/** Speech peaks around -6; above that is clipping, not louder speech. */
const CEIL_DB = -6;

function normaliseMetering(db: number | undefined): number {
  if (db === undefined || !Number.isFinite(db)) return 0;
  const clamped = Math.min(Math.max(db, FLOOR_DB), CEIL_DB);
  const linear = (clamped - FLOOR_DB) / (CEIL_DB - FLOOR_DB);
  // Slight expansion of the quiet end: speech is mostly in the lower half of
  // this window and a raw linear map leaves the meter looking timid.
  return Math.pow(linear, 0.7);
}

/**
 * Why the recording stopped, which is the only thing V-04 and V-13 disagree
 * about. `denied` never produces audio; `capped` and `finalised` both do.
 */
export type RecorderStopReason =
  /** The user tapped Done. */
  | 'user'
  /** Twelve minutes elapsed. The directive's quiet line applies. */
  | 'capped'
  /** The app went to the background mid-recording; we kept what we had. */
  | 'backgrounded';

export type RecorderPermission = 'undetermined' | 'granted' | 'denied';

export type RecorderResult = {
  /** Local file URI of the finished `.m4a`. */
  uri: string;
  durationMs: number;
  reason: RecorderStopReason;
};

export type UseRecorder = {
  permission: RecorderPermission;
  /** Asks, or returns the standing answer. Safe to call more than once. */
  requestPermission: () => Promise<RecorderPermission>;
  isRecording: boolean;
  isPaused: boolean;
  elapsedMs: number;
  /** 0…1, updated ~30Hz, for the V-02 seismograph. Read it on the UI thread. */
  amplitude: SharedValue<number>;
  /** Milliseconds since amplitude was last above the floor. Drives V-03. */
  silentForMs: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  /** Finalises and returns the file. Null if nothing was ever captured. */
  stop: (reason?: RecorderStopReason) => Promise<RecorderResult | null>;
};

export function useRecorder(): UseRecorder {
  // `.m4a`, AAC — the container `transcribe-intake` names in the storage path
  // and the one the ASR endpoint accepts. Metering is opt-in and the whole of
  // V-02 depends on it.
  const recorder = useAudioRecorder({
    ...RecordingPresets.HIGH_QUALITY,
    isMeteringEnabled: true,
  });
  const recorderState = useAudioRecorderState(recorder);

  const [permission, setPermission] = useState<RecorderPermission>('undetermined');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [silentForMs, setSilentForMs] = useState(0);

  const amplitude = useSharedValue(0);

  const meterTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundAt = useRef<number>(0);
  const startedAt = useRef<number>(0);
  /** Accumulated across pauses — `startedAt` alone would count the pause. */
  const accumulatedMs = useRef<number>(0);
  /**
   * Guards the stop path. The cap, the background handler and the user's own
   * Done can all fire within the same tick, and `stop()` on an already-stopped
   * recorder throws.
   */
  const stopping = useRef(false);

  const clearTimers = useCallback(() => {
    if (meterTimer.current) clearInterval(meterTimer.current);
    if (clockTimer.current) clearInterval(clockTimer.current);
    meterTimer.current = null;
    clockTimer.current = null;
  }, []);

  useEffect(() => {
    let alive = true;
    void getRecordingPermissionsAsync().then((res) => {
      if (alive) setPermission(res.granted ? 'granted' : res.canAskAgain ? 'undetermined' : 'denied');
    });
    return () => {
      alive = false;
      clearTimers();
    };
  }, [clearTimers]);

  const requestPermission = useCallback(async (): Promise<RecorderPermission> => {
    const res = await requestRecordingPermissionsAsync();
    const next: RecorderPermission = res.granted ? 'granted' : 'denied';
    setPermission(next);
    return next;
  }, []);

  const stop = useCallback(
    async (reason: RecorderStopReason = 'user'): Promise<RecorderResult | null> => {
      if (stopping.current) return null;
      stopping.current = true;
      clearTimers();

      const duration = accumulatedMs.current + (startedAt.current ? Date.now() - startedAt.current : 0);

      try {
        await recorder.stop();
      } catch {
        // Already stopped, or never started. The URI below is the real answer
        // either way — a throw here must not cost the user the recording.
      }

      setIsRecording(false);
      setIsPaused(false);
      // A Reanimated shared value. Writing `.value` from JS IS the documented
      // API — the compiler flags it because it cannot tell this apart from
      // mutating a plain object it captured. Suppressed rather than worked
      // around: the alternatives (a `runOnUI` hop, or mirroring the level in
      // React state) would either add a frame of latency to a meter that has to
      // track the voice, or re-render this hook sixty times a second.
      // eslint-disable-next-line react-hooks/immutability
      amplitude.value = 0;

      const uri = recorder.uri;
      stopping.current = false;
      if (!uri) return null;

      return { uri, durationMs: Math.max(0, Math.round(duration)), reason };
    },
    [recorder, amplitude, clearTimers],
  );

  /**
   * The cap and the background rule both live here so they cannot disagree with
   * each other, and so `stop` stays the single exit.
   *
   * The directive splits these deliberately: "Recording continues if the screen
   * locks. It does not continue if the app is backgrounded — instead the
   * recording is finalised and the user lands on V-04 with what was captured.
   * Losing four minutes of speech to a phone call is unforgivable; finalising
   * early is merely annoying."
   *
   * `AppState` reports `inactive` for a lock screen or an incoming-call banner
   * and `background` for a genuine departure, so only `background` finalises.
   */
  const onStopRef = useRef<((r: RecorderResult) => void) | null>(null);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'background') return;
      if (!isRecording) return;
      void stop('backgrounded').then((result) => {
        if (result) onStopRef.current?.(result);
      });
    });
    return () => sub.remove();
  }, [isRecording, stop]);

  const start = useCallback(async () => {
    if (permission !== 'granted') {
      const granted = await requestPermission();
      if (granted !== 'granted') return;
    }

    // Recording has to survive the screen locking, which is the normal posture
    // for someone walking a closet with the phone in one hand.
    await setAudioModeAsync({
      allowsRecording: true,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
    });

    await recorder.prepareToRecordAsync({
      ...RecordingPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    });
    recorder.record();

    accumulatedMs.current = 0;
    startedAt.current = Date.now();
    lastSoundAt.current = Date.now();
    setElapsedMs(0);
    setSilentForMs(0);
    setIsRecording(true);
    setIsPaused(false);

    meterTimer.current = setInterval(() => {
      const level = normaliseMetering(recorder.getStatus?.().metering);
      amplitude.value = level;
      // The V-03 nudge waits on genuine quiet, not on a single quiet frame.
      if (level > 0.06) lastSoundAt.current = Date.now();
    }, METER_INTERVAL_MS);

    clockTimer.current = setInterval(() => {
      const total = accumulatedMs.current + (Date.now() - startedAt.current);
      setElapsedMs(total);
      setSilentForMs(Date.now() - lastSoundAt.current);
      if (total >= MAX_RECORDING_MS) {
        void stop('capped').then((result) => {
          if (result) onStopRef.current?.(result);
        });
      }
    }, CLOCK_INTERVAL_MS);
  }, [permission, requestPermission, recorder, amplitude, stop]);

  const pause = useCallback(() => {
    if (!isRecording || isPaused) return;
    recorder.pause();
    accumulatedMs.current += Date.now() - startedAt.current;
    startedAt.current = 0;
    setIsPaused(true);
    // Same as in `stop` above — Reanimated shared value, documented API.
    // eslint-disable-next-line react-hooks/immutability
    amplitude.value = 0;
  }, [recorder, isRecording, isPaused, amplitude]);

  const resume = useCallback(() => {
    if (!isRecording || !isPaused) return;
    // `record()` on a paused recorder resumes the same file rather than
    // starting a second one — which is what V-02's Pause promises.
    recorder.record();
    startedAt.current = Date.now();
    lastSoundAt.current = Date.now();
    setIsPaused(false);
  }, [recorder, isRecording, isPaused]);

  // Surfaced for callers that want the library's own view of things; the hook's
  // own state is what the screen should branch on.
  void recorderState;
  void AudioModule;

  return {
    permission,
    requestPermission,
    isRecording,
    isPaused,
    elapsedMs,
    amplitude,
    silentForMs,
    start,
    pause,
    resume,
    stop,
  };
}
