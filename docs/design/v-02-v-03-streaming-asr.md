# V-02 / V-03 — streaming ASR, and why they are still parked

*Audit, 2026-08-12. Read-only: no code changed, nothing mocked, no dependency
added. This records what the two frames need, what the shipping runtime can do
today, and the exact thing that is missing.*

**Status: blocked on a native dependency and a store build.** Not on a design
decision, not on a founder call, and not on anything that can be reached from
an over-the-air JS packet.

## What the atlas asks for

| | V-02 "Listening — hearing pieces land" | V-03 "Quiet for 25 seconds — a nudge" |
| --- | --- | --- |
| Level meter | live input signal, "not a progress bar" | — |
| Elapsed clock | `2:14`, 15 px tabular | `4:02` |
| **Piece list** | **rows fade in at the bottom as each is heard** | replaced by the nudge |
| **Count** | **"Keep going — 11 pieces so far."** | **"Still here — 23 pieces so far."** |
| Silence | — | **25 s quiet triggers the nudge; cycles every 4 s** |
| Nudges | — | six, in slot order: Tops, Bottoms, Dresses, Shoes, A coat, Bags |

The two cells in bold are the whole of the blocker. Both frames show a **count of
pieces recognised while the microphone is still open**, and V-02 draws the
garments themselves arriving one at a time. That is real-time speech
recognition with incremental parsing — not a recording that is understood later.

## What the runtime does today

The shipping path is **batch, and deliberately so**:

1. `useRecorder` (`src/features/intake/use-recorder.ts`) records one `.m4a` via
   `expo-audio`, up to `MAX_RECORDING_MS` (12 minutes).
2. On Done, `useTranscription` uploads the object and invokes
   `supabase/functions/transcribe-intake`.
3. That function sends the **whole file** to `openai/whisper-large-v3`
   (`index.ts:47`) and returns a transcript.
4. `useParseCloset` turns the transcript into drafts, and the Procession reviews
   them.

Nothing in that chain produces a partial result. The first moment the app knows
a single garment was named is after the recording has stopped, been uploaded,
and come back — which is exactly the information V-02 and V-03 print while the
recording is still running.

### Two parts that are NOT blocked

Worth stating precisely, because it narrows what a future packet has to build:

- **The V-02 level meter already exists.** `useRecorder` exposes
  `amplitude: SharedValue<number>`, "0…1, updated ~30Hz, for the V-02
  seismograph", from `expo-audio`'s `isMeteringEnabled`. No ASR involved.
- **The V-03 silence trigger already exists.** The same hook exposes
  `silentForMs`, whose own docblock reads "Drives V-03". The 25-second
  threshold, the six-nudge cycle, the 4-second interval, the list replacement
  and the polite live region are all reachable with what ships today.

So the parked part is narrower than "V-02 and V-03": it is **the piece list and
the two counts**. A future packet could build V-03's nudge behaviour in full
except for the figure in its header sentence — and a header that said
"Still here" with no count would be a different sentence from the drawn one,
which is a design decision rather than an implementation one.

## What is missing, exactly

### Expo SDK 57 ships no speech recognition

Checked against the installed packages and the SDK 57 reference:

- `expo-audio@57.0.3` is "audio playback and recording". Its API surface has no
  recognition, transcription or speech type. Confirmed by reading
  `node_modules/expo-audio/build/`.
- **There is no first-party Expo speech-to-text module in SDK 57.** Nothing
  named speech/recognition/whisper/vosk is installed, and none is offered.
- `expo-speech` is text-to-**speech**, the opposite direction, and is not
  installed either.

### The one adjacent thing SDK 57 does add, and why it is not the answer

`expo-audio` gained `useAudioStream` — "a native audio stream for real-time PCM
microphone capture" (`node_modules/expo-audio/build/AudioStream.d.ts`). That is
raw audio frames, not words. It would let the app *send* live audio somewhere,
which means the two routes below.

## The two ways to close it, and what each costs

### A · On-device recognition (iOS `SFSpeechRecognizer`)

The community module `expo-speech-recognition` wraps Apple's own recogniser. It
is **not installed**, and it is a native module, so:

- a new dependency in `package.json`;
- a new Info.plist key, **`NSSpeechRecognitionUsageDescription`**, which is a
  second permission prompt on top of the microphone one;
- **a new store build.** No OTA update can add a native module — this is the
  same wall `docs/ops/crash-reporting.md` documents for audit #22.

It has one strong property worth recording: on-device recognition means the
audio does **not** leave the phone for the live half, which sits well with the
consent posture. The batch Whisper pass would still exist for the accurate
transcript, so this would be a second recogniser rather than a replacement.

### B · Streaming ASR over the network

`useAudioStream` piped to a realtime endpoint (Deepgram, AssemblyAI, OpenAI
Realtime). This needs **a new vendor, a new secret, a new privacy disclosure and
a rewrite of the consent facts** — the microphone audio would leave the device
continuously rather than as one file after the user pressed Done, which is a
materially different promise from the one `consent-facts.ts` currently makes.

That is a founder decision about what the app tells people, not an
implementation choice, and it is outside every standing constraint on these
packets.

## Recommendation

**Stop here.** Route A is the one that fits the app's existing posture, and it
is blocked on precisely two things a JS packet cannot do: adding a native module
and cutting a store build. Neither is a judgement call — they are the same
build-time wall as audit #22, and they should be scheduled with whatever native
work comes next rather than attempted piecemeal.

If a partial slice is wanted before then, the honest one is **V-03's nudge
mechanism on the existing `silentForMs`**, with the count omitted from its
header and that omission recorded as a deviation. That is a design call on a
drawn sentence, so it needs an answer before it is worth building.

## What was NOT done, on purpose

- No mocked microphone, no simulated partial transcript, no fixture that poses a
  live count the runtime cannot produce. A fixture showing rows landing in real
  time would be a picture of a capability that does not exist, and every review
  of it afterwards would be reviewing the mock.
- No speculative native integration, no dependency added, no permission touched.
