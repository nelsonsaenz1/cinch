/**
 * The one place in the app that names the attribution SDK.
 *
 * WHY THIS FILE EXISTS
 *
 * Same reason as `src/features/push/native.ts`, which this deliberately
 * mirrors: a top-level import of an absent native module throws during module
 * evaluation, and a throw during module evaluation cannot be caught by the
 * screen that imported it. One OTA, every user, white screen. The import
 * happens exactly once, inside a try, behind a `require`.
 *
 * WHAT THIS IS FOR
 *
 * Exactly one thing: carrying an invite handle through an App Store install.
 * iOS has no supported mechanism for it — a universal link opens the app when
 * the app is there, and when it is not, the tap goes to the store and the
 * original URL is gone. An attribution SDK closes that gap by matching the
 * install back to the click.
 *
 * IT IS NOT LOAD-BEARING. Every other route in atlas 39's routing table works
 * without it:
 *
 *   * app installed → the universal link opens IV-06 directly,
 *   * already signed in → deep link with the friendship applied,
 *   * handle gone → IV-05,
 *   * android or desktop → the landing page.
 *
 * The only path it improves is cold install, and the fallback there is honest
 * and stated on the landing page: install, then tap the link again. So when
 * this reports unavailable, the invite still works — it just asks for a second
 * tap from people who did not have the app.
 *
 * WHY THE APP CAN SHIP WITHOUT THE PACKAGE INSTALLED
 *
 * The stable release of the SDK we chose predates the New Architecture and
 * declares no codegen spec; the rewrite that targets New Arch pins
 * `react-native <0.85`, and this app runs 0.86 with no opt-out. Rather than
 * gamble a store build on an interop layer, the shim ships first and the
 * package is added once it has been compile-tested. Adding it is a one-line
 * change to `load()` and a plugin entry in app.config.ts — nothing that
 * consumes this file changes at all.
 *
 * THE RULE FOR EVERY OTHER FILE: import from here, never from the package. A
 * single stray direct import undoes all of it, and it will not be caught by
 * typecheck, by tests, or by the simulator — only by the OTA.
 */

/**
 * The surface this app actually uses, named here so consumers get types
 * without importing the package. One method: what invite did this install
 * come from. Deliberately tiny — this is a list of what the SDK is allowed to
 * do, and growing it is a decision with a privacy disclosure attached.
 */
export interface DeferredLinkModule {
  /**
   * Resolves the handle this install arrived from, or null when the install
   * was not attributable — which is the ordinary case and not an error.
   */
  pendingInviteHandle(): Promise<string | null>;
}

function load(): DeferredLinkModule | null {
  try {
    // The package is not in package.json yet — see the docblock. `require` of
    // a missing module throws, which is exactly what the catch is for, so this
    // resolves to null today and to the real module the moment it is added.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-branch') as
      | { getLatestReferringParams?: () => Promise<Record<string, unknown>> }
      | undefined;

    if (!mod || typeof mod.getLatestReferringParams !== 'function') return null;

    return {
      async pendingInviteHandle() {
        const params = await mod.getLatestReferringParams!();
        // `+clicked_branch_link` is the SDK's own flag for "this session came
        // from a link we recognise". Without it the params are the empty
        // object it returns for every organic open, and reading a handle out
        // of that would attribute installs to whoever was invited last.
        if (params?.['+clicked_branch_link'] !== true) return null;
        const handle = params?.['handle'];
        return typeof handle === 'string' && handle.length > 0 ? handle : null;
      },
    };
  } catch {
    return null;
  }
}

/**
 * Resolved once, at module scope: a binary either has the native module or it
 * does not, and that cannot change during a session.
 */
const loaded = load();

/**
 * Whether this build can attribute a cold install to an invite.
 *
 * Not a preference, not a permission, not a setting — a fact about the binary.
 * Callers use it to decide whether it is worth asking at all; nothing about
 * the invite UI changes when it is false.
 */
export const DEFERRED_LINKS_AVAILABLE: boolean = loaded !== null;

export const deferredLinks: DeferredLinkModule | null = loaded;
