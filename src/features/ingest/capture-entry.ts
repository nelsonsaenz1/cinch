/**
 * Which door `/capture` was reached through, and whether the camera gate's
 * three full-screen states — the capability guard (CP-04, module absent), the
 * pre-prompt ask (CP-02, `access === 'unasked'`), and the blocked recovery
 * page (`access === 'blocked'`) — are allowed to intercept it. Pure, no React
 * and no IO, so the node suite exercises every branch directly (the house
 * split: reveal-zero-core, trial-expired-core, returning-free-core).
 *
 * ── THE BUG THIS CLOSES (funnel run 2026-08-31, issue 2) ───────────────────
 *
 * `?start=library` from the Add Clothes chooser's Photo library door
 * (`add-clothes.tsx`) means exactly one thing: open `pickFromLibrary()`
 * (`use-capture.ts`), which is `ImagePicker.launchImageLibraryAsync` and asks
 * the OS for nothing the camera owns — see `intake-routes.ts`'s own line for
 * that door, "no permission needed". A camera fact can therefore never be a
 * legitimate reason to stop a library entry, and three separate camera facts
 * were doing exactly that:
 *
 *   1. `CaptureRoute` drew CP-04's `CameraUnavailable` notice unconditionally
 *      whenever `!CAMERA_AVAILABLE` — the simulator's own condition — with no
 *      look at `?start=`. Its own "Use the photo library" button then sent the
 *      reader back to `/add-clothes?door=library`, which immediately reopens
 *      `/capture?start=library` and hits the identical guard again: a loop
 *      with no way to the picker at all.
 *   2. `CaptureScreen`'s `access === 'unasked'` branch (CP-02's pre-prompt)
 *      painted a full-screen ask about the CAMERA in front of someone who
 *      never asked for it.
 *   3. `CaptureScreen`'s `access === 'blocked'` branch did the same for a
 *      camera permission denied on a real device — this is the "devices with
 *      camera denied/blocked" half of the defect. Both eventually resolved via
 *      the 450ms deferred auto-start (`guardedRef.current(autoStart)`), so the
 *      picker DID open a moment later, but only after flashing camera UI that
 *      had nothing to do with the door the reader tapped.
 *
 * `bypassesCameraGate` is the one place all three call sites now ask the same
 * question, mirroring the pattern `the-ten.tsx` already ships for its own
 * guided-walk camera slot: `cameraSlot && !CAMERA_AVAILABLE && cameraStart
 * !== 'library'`.
 */

/** The three ways this route can be told what to open on arrival. */
export type CaptureEntry = 'library' | 'describe' | 'camera';

/**
 * `?start=` arrives as `expo-router`'s `useLocalSearchParams` value, which is
 * a string for a normal navigation and can come back as an array when a URL
 * repeats the key. Anything else — absent, or a value neither door names —
 * is the camera door: no parameter is exactly what the Camera plate sends,
 * since the live stage IS the capture screen and there is nothing to open
 * over it (see `capture.tsx`'s own note on the chooser doors).
 */
export function captureEntryFrom(start: string | string[] | undefined): CaptureEntry {
  const value = Array.isArray(start) ? start[0] : start;
  return value === 'library' ? 'library' : value === 'describe' ? 'describe' : 'camera';
}

/**
 * Whether this entry needs no camera fact to gate it at all.
 *
 * Only the library door qualifies: `pickFromLibrary` is the only one of the
 * three actions that touches neither the capability probe nor the camera
 * permission. Describe leaves this screen for `/find-photo` and is unaffected
 * by camera state either way, but is deliberately NOT included here — it
 * already routes around every camera branch on its own path through `run`,
 * and folding it in here would be a change nobody asked for.
 */
export function bypassesCameraGate(entry: CaptureEntry): boolean {
  return entry === 'library';
}
