import { useCallback, useEffect } from 'react';
import { AppState, Linking } from 'react-native';

/**
 * CP-04 — `expo-camera` is required, not imported.
 *
 * `expo-camera` resolves its native module at import time and THROWS when a
 * binary does not carry it, which an over-the-air bundle on a stale native
 * client can arrange. A static import here would take down every screen that
 * merely wants to ASK about the camera — including the chooser whose job is to
 * say the camera is unavailable. So the module is required behind a guard and
 * the hook below degrades to a fixed answer when it is absent.
 *
 * `CAMERA_AVAILABLE` decides what a screen DRAWS; this decides whether it is
 * safe to call into the package at all. They read the same fact from two
 * places on purpose: this file must not import the probe, because the probe
 * must stay free of anything that could pull `expo-camera` in behind it.
 */
const cameraModule: { useCameraPermissions?: unknown } | null = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-camera') as { useCameraPermissions?: unknown };
  } catch {
    return null;
  }
})();

type PermissionsHook = () => [
  { granted: boolean; status: string; canAskAgain: boolean } | null,
  () => Promise<unknown>,
  () => Promise<unknown>,
];

/**
 * The real hook, or a stand-in that reports `checking` forever.
 *
 * `checking` rather than `blocked` for the same reason `undetermined` is folded
 * into it below: a build with no camera module has not been refused anything,
 * and a door accusing somebody of a refusal they never made is the one answer
 * that is certainly wrong. What such a build actually draws is CP-04, chosen by
 * `CAMERA_AVAILABLE` before this hook is ever consulted.
 */
const useCameraPermissions: PermissionsHook =
  typeof cameraModule?.useCameraPermissions === 'function'
    ? (cameraModule.useCameraPermissions as PermissionsHook)
    : () => [null, async () => null, async () => null];

/**
 * The three states a camera-permission-gated stage has to draw, deliberately
 * not the same as the four `PermissionResponse` can be in:
 *
 * - `checking` — we have not read the status yet, OR it is undetermined and the
 *   OS alert is up. Both are "don't claim anything yet": drawing the blocked
 *   plate under a live permission alert accuses the user of a refusal they have
 *   not made.
 * - `granted` — run the preview.
 * - `blocked` — answered, and the answer was no. On iOS the first "Don't Allow"
 *   is final (`canAskAgain` goes false), so this state must offer Settings
 *   rather than another prompt. Apple rejects apps whose core screens dead-end
 *   on a declined permission, and this is a core screen.
 *
 * This used to be paired with a hook (`useCameraAccess`, removed) that fired
 * the system request from an effect on mount — ASKED ON ARRIVAL, NOT ON THE
 * SHUTTER, because a viewfinder with no permission is a silent black rectangle
 * otherwise. That fixed a real bug (the founder's report of "a blank camera
 * that only asks after I click take-a-picture") but traded it for a different
 * one: the alert firing before any in-product rationale was on screen. `The
 * Ten` and `TenCamera` were its last two callers; both now read this same
 * three-state fact through `useCameraGate` below and raise the request from
 * an explicit tap, behind `CameraAsk` — the same pre-permission moment CP-02
 * gave the capture stage. `useCameraStatus` still reads this type read-only,
 * for doors that only need to know the door's condition, never to knock on it.
 */
export type CameraAccess = 'checking' | 'granted' | 'blocked';

/**
 * The same three states, READ ONLY — never a prompt.
 *
 * The chooser (AC-03) states the camera's condition on the door before anyone
 * taps it, which is the opposite of what `useCameraAccess` is for: a screen
 * that is only offering the camera as one of four ways in has no business
 * raising the system alert on arrival. The alert belongs to the surface that
 * actually needs the permission, and that is still the capture stage.
 *
 * `useCameraPermissions` defaults to a `get` on mount with no request, so this
 * is the hook without the effect that asks. The foreground refresh stays:
 * someone who leaves for Settings and comes back must find the door open.
 */
export function useCameraStatus(): { access: CameraAccess; openSettings: () => void } {
  const [permission, , refreshPermission] = useCameraPermissions();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  return { access: accessOf(permission), openSettings };
}

/**
 * The one derivation both hooks read from. `undetermined` is deliberately
 * folded into `checking` rather than `blocked`: a door that says "camera
 * access is off" to somebody who has never been asked accuses them of a
 * refusal they never made.
 */
function accessOf(permission: ReturnType<typeof useCameraPermissions>[0]): CameraAccess {
  return !permission
    ? 'checking'
    : permission.granted
      ? 'granted'
      : permission.status === 'undetermined'
        ? 'checking'
        : 'blocked';
}

/**
 * CP-02 — the pre-prompt, and the four states it needs to tell apart.
 *
 * The retired `useCameraAccess` folded "never asked" into `checking` and fired
 * the system request from an effect on mount. That was CP-02's original
 * exception: a pre-prompt is impossible if the system alert has already gone
 * up by itself, so this hook asks for NOTHING on mount and hands the request
 * back as a function instead. `unasked` is the state CP-02 draws — over
 * `CameraAsk` (`src/components/ingest/camera-ask.tsx`), which states what the
 * permission is for, that the following prompt belongs to the system, and
 * where the photograph goes, with a real second door (never a decline) so
 * refusing does not end the intake. The other three states are unchanged.
 *
 * Every surface that opens a live viewfinder uses this hook now — the capture
 * stage first, and since the 2026-09-02 audit's P1 #33, The Ten's guided
 * capture (`the-ten.tsx`, `ten-camera.tsx`) too: deep entry into onboarding
 * used to fire the system dialog on arrival, before any of this screen's own
 * rationale was ever read.
 */
export type CameraGate = 'unasked' | 'checking' | 'granted' | 'blocked';

export function useCameraGate(): {
  access: CameraGate;
  /** Raises the system alert. One tap, one prompt — never called from an effect. */
  request: () => void;
  openSettings: () => void;
} {
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshPermission();
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const request = useCallback(() => {
    void requestPermission();
  }, [requestPermission]);

  const openSettings = useCallback(() => {
    void Linking.openSettings();
  }, []);

  const access: CameraGate = !permission
    ? // The status has not been read yet. Not `unasked`: showing the ask to
      // somebody who granted the camera months ago, for the one frame before
      // the read lands, is a prompt they have already answered.
      'checking'
    : permission.granted
      ? 'granted'
      : permission.status === 'undetermined'
        ? 'unasked'
        : 'blocked';

  return { access, request, openSettings };
}
