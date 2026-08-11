# Native drift, and how it announces itself

*Audit item 4. Written 2026-08-11.*

## The failure this prevents

`runtimeVersion.policy` in `app.config.ts` is **`appVersion`**. That means an
OTA update is accepted by any installed build carrying the same version string —
**whether or not its native layer matches**.

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

## What this is NOT

It is not enforcement. It is a script somebody has to run.

The enforcing version is `runtimeVersion: { policy: 'fingerprint' }`, which
makes Expo itself refuse to deliver an OTA to a mismatched binary — no script,
no discipline required. **That change was not made here**, and the reason is a
shipping consequence rather than a technical one:

> Switching the policy changes the runtime version of every future build.
> Installs already in the wild are on runtime version `1.0.x` (the app version).
> They would stop receiving OTAs entirely until a new store build reached them —
> which, for anyone who does not update promptly, means indefinitely.

That is a decision about users, not about tooling, and it belongs to the founder.
The sensible moment to make it is **immediately before a store build ships
anyway**, so the window where anyone is stranded is as short as it can be. Until
then the script is the whole of the protection, and it only works if it is run.

## Where it should run

- Before any `eas update`. The OTA protocol already requires a clean tree; this
  is the same class of pre-flight check and belongs beside it.
- After `npx expo install --fix`, `expo prebuild`, or any dependency change.

## Related

- `scripts/check-fingerprint.mjs` — the script, and the reasoning in its header
- `app.config.ts` — `runtimeVersion`, and the plugin list the fingerprint covers
