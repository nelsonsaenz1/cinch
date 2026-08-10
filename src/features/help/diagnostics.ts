/**
 * What rides along with a note, and the words that describe it.
 *
 * HS-04 prints "app version 2.4.1, iPhone 15 Pro, iOS 19.2". None of those
 * three numbers is real — the atlas invented them, as atlases do. This reads
 * the actual ones.
 *
 * ── The atlas's own rule, which this file exists to keep ──────────────────
 *
 * "Say what is attached. Diagnostics are listed in plain words before sending,
 * and closet content is never among them." So `DIAGNOSTIC_LINES` is generated
 * from the same object that is sent, in the same order, and there is no field
 * on `SupportDiagnostics` that does not have a line describing it. A field
 * added without a line is a blind handover, which is the one thing this panel
 * is for.
 *
 * ── Why nothing here is imported by articles.ts or search.ts ──────────────
 *
 * This file touches `react-native`, `expo-constants` and `expo-device`, so it
 * cannot appear in the graph the unit tests bundle. Screens import it; pure
 * data does not.
 */

import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export type SupportDiagnostics = {
  /** The `@handle`, without the `@`. Null when one has not been claimed. */
  readonly handle: string | null;
  /** "1.0.0 (218)", or "1.0.0" when there is no build number to name. */
  readonly appVersion: string;
  /** "iPhone 15 Pro", or null when the device module has nothing to say. */
  readonly device: string | null;
  /** "iOS 19.2", or null. */
  readonly os: string | null;
};

/**
 * "Cinch 1.0.0 (218)" — the profile screen's own formatting, at
 * `src/app/profile.tsx:227-228`, minus the wordmark.
 *
 * `ios.buildNumber` is null in Expo Go, in a bare `expo start`, and anywhere
 * EAS has not stamped one, so the parenthesis is DROPPED rather than printing
 * "(undefined)" or "(null)" into an email a person will read. `version` itself
 * comes from `app.config.ts:66` and is present in every build, but it is typed
 * optional, so the fallback is a word rather than an empty string — a version
 * line that reads "Cinch" and stops is worse than one that says it does not
 * know.
 */
export function appVersionLabel(): string {
  const version = Constants.expoConfig?.version ?? null;
  const build = Constants.expoConfig?.ios?.buildNumber ?? null;
  if (!version) return 'unknown';
  return build ? `${version} (${build})` : version;
}

/**
 * The device model, as Apple names it.
 *
 * `expo-device` is in `package.json:23` and in `ios/Podfile.lock` (`ExpoDevice
 * (57.0.1)`) — already compiled into the binary by autolinking, so using it is
 * a new import of an existing dependency and not a native change. It had ZERO
 * import sites in `src/` before this file, so this is the first caller, and
 * what it actually returns was checked against the module's own Swift rather
 * than assumed:
 *
 *   `modelName` is a synchronous `Constant` (`ios/DeviceModule.swift:25`)
 *   resolving `utsname().machine` through a lookup table
 *   (`ios/UIDevice.swift:24-215`). On a real phone that is the marketing name —
 *   "iPhone 15 Pro". On a Simulator the machine string is `arm64`, which the
 *   table maps to the literal **"Simulator iOS"** (`UIDevice.swift:191-192`),
 *   NOT the simulated model. That is the right answer for a support note: a
 *   report from a simulator should say so.
 *
 * `deviceName` is deliberately not read. It is `UIDevice.current.name` —
 * "Nelson's iPhone" — which is a person's name in an email they did not know
 * they were sending.
 *
 * Wrapped anyway. A constant read from a native module is a native call by
 * another name, and a support form that throws on the way to describing itself
 * is the worst possible place to discover that. A missing model is a null in
 * the payload and a line that says so, never a crash and never a guess.
 */
export function deviceLabel(): string | null {
  try {
    return Device.modelName ?? null;
  } catch {
    return null;
  }
}

/** "iOS 19.2". `Platform.Version` is the string iOS reports. */
export function osLabel(): string | null {
  try {
    const name = Device.osName ?? (Platform.OS === 'ios' ? 'iOS' : Platform.OS);
    const version = Device.osVersion ?? String(Platform.Version ?? '');
    if (!version) return name || null;
    return `${name} ${version}`.trim();
  } catch {
    return null;
  }
}

export function collectDiagnostics(handle: string | null): SupportDiagnostics {
  return {
    handle: handle && handle.length > 0 ? handle : null,
    appVersion: appVersionLabel(),
    device: deviceLabel(),
    os: osLabel(),
  };
}

/**
 * The panel's contents, in plain words, one line per field.
 *
 * Written as sentences rather than as `key: value` pairs because the point is
 * comprehension, not a manifest — a reader who cannot tell what "locale" means
 * has not been told anything. Each line names the value it will send, so there
 * is no gap between the description and the thing described.
 *
 * The email line is here even though the address is NOT in `SupportDiagnostics`:
 * the edge function reads it from the caller's token, so it is attached whether
 * or not this object carries it, and listing only what the client happens to
 * serialise would be a technically-true panel that misleads. The panel is about
 * what reaches us.
 */
export function diagnosticLines(d: SupportDiagnostics): readonly string[] {
  return [
    d.handle ? `Your handle, @${d.handle}.` : 'Your account — you have not claimed a handle yet.',
    'The address you sign in with, so a reply can reach you.',
    `The version you are running, Cinch ${d.appVersion}.`,
    d.device && d.os
      ? `Your phone and its system, ${d.device} on ${d.os}.`
      : d.device
        ? `Your phone, ${d.device}.`
        : d.os
          ? `Your system version, ${d.os}.`
          : 'Your phone model, if it can be read — it could not be, this time.',
  ];
}

/**
 * The line under the list.
 *
 * Two things have to be true at once: no closet content is ever attached, AND
 * a screenshot the reader chose to attach obviously is. So the sentence is
 * about what Cinch takes rather than about what the email contains — nothing is
 * read off the closet, and anything else in the note is there because it was
 * put there.
 */
export const DIAGNOSTICS_FOOTNOTE =
  'Nothing is read from your closet — no photographs, no pieces, no figures. Anything else in this note is what you wrote or attached.';
