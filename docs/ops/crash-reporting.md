# Crash reporting — audit #22, NOT IMPLEMENTED

*Written 2026-08-11 after an attempt that was reverted. This document records why
the gap exists and what closing it requires. It is not the fix.*

**Status: open.** There is no native crash reporting in this app today. Nothing
in `src/` imports a crash SDK; `package.json` has no crash dependency; the iOS
project contains no crash-reporter build phase. If you are here to find out
whether native crashes are being captured, the answer is no.

## The gap

| Layer | Covered by | Status |
| --- | --- | --- |
| Uncaught JS exceptions, unhandled rejections | PostHog `errorTracking.autocapture` | live since audit 86 |
| Native crashes | — | **nothing** |

PostHog's autocapture is complete for the JS layer and structurally incapable of
covering the one underneath, because a JS handler needs a running JS thread.
None of the following produces a report today, and none did before:

- a Swift or Objective-C exception — the JS thread is already gone
- SIGSEGV / SIGABRT from a native module
- an **out-of-memory termination**, the likeliest real crash in an app that
  holds full-resolution garment photographs
- a watchdog kill during a slow launch
- anything that happens before the bundle has loaded

The app disappears, the user opens it again, and nobody learns anything. That is
still true.

## What was attempted, and why it was backed out

`@sentry/react-native` was added, configured, and prebuilt. It compiled. It then
**failed the iOS build**:

```
error: sentry-cli - To disable source maps auto upload, set SENTRY_DISABLE_AUTO_UPLOAD=true
error: An organization ID or slug is required (provide with --org)
** BUILD FAILED **
```

The cause is the Expo config plugin, not the SDK. The plugin rewrites the
"Bundle React Native code and images" build phase to run Sentry's upload script
alongside the bundler. That script requires a Sentry organisation, and on not
finding one it **exits non-zero rather than warning** — so a project with no
Sentry account cannot build at all.

The documented off-switch does not work from a dotenv file. Sentry's build
script reads `SENTRY_DOTENV_PATH` and hands that path to `sentry-cli`; it does
not source the file into its own shell. `SENTRY_DISABLE_AUTO_UPLOAD` is read
from the Xcode build environment, so putting it in `.env.sentry-build-plugin`
leaves it unset where it is actually checked. Suppressing the upload therefore
means setting the variable in *two* places — the Xcode environment for local
builds and the EAS build profile for cloud builds — in order to pre-stage an SDK
that, with no DSN, reports nothing.

That is a build-breaking dependency and two environment-plumbing obligations in
exchange for zero coverage until the founder-side prerequisites below are done.
It was reverted rather than shipped inert.

**The revert is verified complete**, not assumed: `npx expo prebuild --clean` +
`pod install` returns to "139 dependencies, 142 total pods", a case-insensitive
grep for `sentry` across `src/`, `package.json`, and the Xcode project returns
nothing, and `npm run check:fingerprint` reports the native tree unchanged at
its recorded baseline `b02a51d`. The same tool is what caught the addition — it
had moved from 165 to 174 native sources while Sentry was installed.

## Prerequisites — all founder-side, none of them code

Audit #22 cannot be closed from this repo alone. In order:

1. **Create a Sentry organisation and a project** (platform: React Native).
   Without an organisation the build plugin fails, so this is a hard blocker on
   even installing the SDK — not merely on it functioning.
2. **Record the org slug**, which the build plugin needs at *build* time, and
   the **DSN**, which the SDK needs at *run* time. These are different values
   with different lifetimes; conflating them is what makes this look simpler
   than it is. The DSN is not a secret in the way an API key is — it is embedded
   in every client build and can only submit events — but both still live in the
   environment, never in the repo.
3. **Decide who receives crash alerts** and set that up in Sentry before the
   first build reaches anyone, or the first real crash lands in an inbox nobody
   reads.

Once those exist, the implementation is roughly a day: install the SDK, set the
org slug in the EAS build profile and `.env`, add an init module with the
privacy configuration below, and cut a store build — this **cannot ship over the
air**, because Sentry links native code. See
[native-fingerprint.md](native-fingerprint.md).

## Privacy configuration — decided, and worth keeping

This part of the attempt was correct and should be carried into whatever
implementation eventually lands. A crash reporter's default instinct is to
capture everything, which is the wrong instinct for an app whose screen is
usually a photograph of somebody's clothes:

| Setting | Value | Why |
| --- | --- | --- |
| `sendDefaultPii` | `false` | Would attach IP, and with the session in scope, an email. A stack trace makes a crash fixable; who it happened to does not. |
| Breadcrumbs integration | console and XHR removed | The console breadcrumb forwards anything the app ever logged; the XHR one records URLs. Keep navigation and lifecycle. |
| `attachScreenshot` | `false` | The screen at the moment of a crash is a photograph of someone's wardrobe. |
| `attachViewHierarchy` | `false` | The same content, in structured form. |
| `tracesSampleRate` | `0` | Performance tracing samples ordinary sessions — a different product, and a lot of data about people who had no problem. |
| `enabled` | `!__DEV__` | Dev builds crash on purpose. Reporting them buries the real ones. |
| `beforeSend` | strips `user`, `server_name`, cookies | Belt and braces, in case a future SDK version starts populating them by default. |

The layer split is also deliberate and should hold: native crashes to the crash
reporter, JS errors to PostHog. One product per layer beats two half-records of
each.

## Alternatives, if the Sentry prerequisites stay unmet

- **Apple's own crash reports** (Xcode Organizer → Crashes) arrive with no SDK,
  no build plugin, and no third party receiving data — but only for users who
  opted into sharing diagnostics, only after App Store review, with no
  breadcrumbs and no way to tie a crash to an app-level event.
- **Doing nothing** is the current state. It is survivable pre-launch and not
  survivable once real wardrobes are in the app, because OOM terminations on
  large photo libraries are the failure this codebase is most likely to have.

## Related

- [native-fingerprint.md](native-fingerprint.md) — why this needs a store build,
  and the tool that verified the revert
- `src/lib/posthog.tsx` — the JS layer that *is* live, and why console
  autocapture is off there
