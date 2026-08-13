# Native drift, and how it announces itself

*Audit item 4. Written 2026-08-11.*

## The failure this prevents

Before the first release candidate, `runtimeVersion.policy` in `app.config.ts`
was **`appVersion`**. That meant an OTA update could be accepted by any installed
build carrying the same version string — **whether or not its native layer
matched**.

So the failure mode is:

1. Somebody adds or bumps a package with native code.
2. Nothing about the version changes.
3. `eas update` ships the JS.
4. It lands on a binary built from *different* native code.

And what the user sees is not "missing native module". It is a router error, a
white screen, or a crash on a screen unrelated to the change — because the
failure surfaces wherever the missing thing is first touched, which is rarely
where it was introduced. That is what makes this worth tooling: the symptom
points away from the cause.

## The check

```bash
npm run check:fingerprint
```

`@expo/fingerprint` hashes everything that ends up in the binary — the native
projects, the config plugins, the packages carrying native code, the
entitlements, `package.json` — and returns one hash. `fingerprint.json` records
the hash of the build that is **in the store**. If they differ, the tree needs a
store build rather than an OTA.

Verified 2026-08-11 to be stable and to ignore what it should:

| Change | Fingerprint |
| --- | --- |
| nothing | unchanged |
| editing a `src/**` file | **unchanged** — a JS change is not native drift |
| adding a dependency | changes |
| editing `package.json` at all, including scripts | changes |

That last row is a mild false positive and is left alone deliberately: the cost
is one unnecessary "run a store build?" question, and the alternative — teaching
the tool to parse which part of `package.json` matters — is a second place for
the definition of "native" to be wrong.

## When to re-record the baseline

```bash
npm run check:fingerprint -- --set
```

**Only at the moment a store build is submitted**, because the baseline means
"this is what the binary in the store contains". Running it at any other time
makes the check say what you want to hear.

## Enforcement

The first release candidate switches to
`runtimeVersion: { policy: 'fingerprint' }`. Expo now refuses to deliver an OTA
to a binary whose native fingerprint differs, even when its App Store version
is unchanged. The switch is intentionally paired with a new Store build; older
pre-release builds keep their old runtime and cannot receive the candidate's
updates.

The script remains useful as a release ledger. Expo enforces delivery safety;
the recorded baseline tells a human whether the current tree still matches the
binary that was submitted.

## Where it should run

- Before any `eas update`. The OTA protocol already requires a clean tree; this
  is the same class of pre-flight check and belongs beside it.
- After `npx expo install --fix`, `expo prebuild`, or any dependency change.

## Related

- `scripts/check-fingerprint.mjs` — the script, and the reasoning in its header
- `app.config.ts` — `runtimeVersion`, and the plugin list the fingerprint covers
