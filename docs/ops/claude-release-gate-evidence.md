# Release gate evidence — the asserted native change is false

Owner: Claude Code (release lane), 2026-08-16. **This file does not edit
`docs/ops/claude-canonical-reconciliation.md`.** That ledger is under an active
owner — uncommitted work by that lane was present in the primary checkout while
this was written — so its release-gate section is left alone and corrected here
by handoff instead.

Scope of the correction: the canonical ledger's "Release classification
(carried forward, still current)" (`cdbe3412`, lines 108–116), which states that
`main` cannot ship as an OTA and requires a new store build.

## The claim, and why it is wrong

The ledger cites `npm run check:fingerprint` in the canonical checkout:

```
  recorded  d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6   2026-08-16 @ 9345eb2   169 sources
  current   b07ed5b24bc13c26f79ddc34e02b0cba143d1632                           73 sources
```

That comparison is invalid for **two independent reasons**, either one of which
alone breaks it. It is not a native change.

1. **The install layout.** `node_modules/*` in this checkout are symlinks into
   `node_modules/.deno/<pkg>@<ver>/node_modules/<pkg>/…`. `@expo/fingerprint`
   hashes resolved paths, so every autolinked package hashes differently than in
   the `npm ci` tree EAS installs from `package-lock.json`. This is what
   collapses 169 sources to 73.
2. **The `ios/` directory.** It is gitignored (`.gitignore:46`, 0 tracked files)
   *and* excluded by `.easignore:66`. The local run hashes it as a
   `bareNativeDir` source; **EAS never receives it.** The local run fingerprints
   a bare-workflow project; EAS fingerprints a managed/CNG one.

## The controlled experiment

Clean clone, **no `ios/`** (exactly what `.easignore` uploads), `npm ci` from the
identical lockfile, `EAS_BUILD_PROFILE=production` with the production `env`
block from `eas.json` — the same profile and install layout used for Store
build 38.

| Computation | Hash | Sources |
|---|---|---|
| HEAD `cdbe3412`, same profile/layout | `d9cb8c3b…` | 168 |
| `9345eb2` — the commit build 38 was built from (**method control**) | `d9cb8c3b…` | 168 |
| `c86be8d` — the fix commit | `d9cb8c3b…` | 168 |
| Recorded baseline `fingerprint.json` | `d9cb8c3b…` | 169 |
| Local Deno-layout run **with** `ios/` (what the ledger cites) | `b07ed5b2…` | 73 |

The control is the point: computing at build 38's own commit reproduces the
runtime EAS stamped on build 38. The method is therefore validated, and every
commit through the fix yields the identical hash.

## Independent corroboration from EAS

Under `runtimeVersion.policy: 'fingerprint'` (`app.config.ts:593`), EAS computes
the runtime itself. It has now produced `d9cb8c3b…` four separate times:

- Store build 37 — runtime `d9cb8c3b…`, commit `9345eb2`
- Store build 38 — runtime `d9cb8c3b…`, commit `9345eb2`
- OTA `01a00c0f…` — runtime `d9cb8c3b…`, commit `b00d38d`
- OTA `01a00c69…` — runtime `d9cb8c3b…`, commit `c86be8d` (published today;
  the CLI's own "Computing project fingerprints" step)

And every fingerprint input tree is byte-identical between `9345eb2` and
`c86be8d`: `package.json`, `package-lock.json`, `app.config.ts`, `eas.json`,
`.easignore`, `.gitignore`, `plugins/`, `modules/`.

**Conclusion: the native layer has not changed. No new store build is required;
one would build an identical runtime.** No build or submission was produced.

## Tooling defect — since repaired (`d572070`)

`check:fingerprint` hashed the working directory, so it was not trustworthy in
this checkout and `scripts/release-ota.mjs:67` inherited that, blocking a
legitimate publish.

It now takes the fingerprint over `git archive <rev>` — the tracked tree and
nothing else, so no untracked or gitignored artifact can reach it — with a clean
`npm ci` from the committed lockfile: what EAS uploads, installed the way EAS
installs it. Deliberately not a `fingerprint.config.js`, which would be uploaded
and honoured by EAS too and would move the canonical runtime every shipped
binary is keyed to.

`npm run check:fingerprint -- --verify-control` recomputes `9345eb2` and must
reproduce the runtime EAS stamped on build 38; a failing verdict now sends the
reader there before it says "store build". Measured while fixing it: a
**gitignored** `ios/` is inert — it moves the source count 168 → 169 and not the
hash, because gitignored content hashes as empty. That corrects this document's
first draft, which implied `ios/` was co-responsible for the wrong hash. The
install layout was the whole of it. `ios/` is fenced off anyway.

Coverage is `tests/fingerprint-gate.test.ts`. The live two-revision control is
opt-in (`CINCH_FINGERPRINT_CONTROL=1 npm test`) because it costs an `npm ci`
per revision; the default suite pins the shape of the repair.

## What shipped

Commit `c86be8d` "Classify the deadline where it actually fires" — CI green
(run 31971719496: check, database, functions).

The validated `9d67a0c` slice was **absent from main and from production**,
contrary to the recovery ledger's row 10 `SUPERSEDED` verdict, which deferred it
as "residual edge-function differences … service-owned". Deployed `generate-outfits`
v38 had `response.json()` outside the `catch`, no `asOpenRouterError`, and no
`styling_timeout`. Ported minimally (not cherry-picked; main's `local` status,
enhancement gate and configured timeout floor are preserved, and the commit's
model repoint is deliberately excluded — it was applied live).

- Edge Function `generate-outfits` **v40 ACTIVE**, `verify_jwt` unchanged,
  byte-identical to committed `c86be8d` across all eight bundled files.
- OTA `01a00c69-3efc-73a6-839e-b0bc2604948f`, group
  `7380b772-f772-47d9-a82d-2ca261034e54`, branch/channel `production`, runtime
  `d9cb8c3b…`, commit `c86be8d`. Reaches builds 37 and 38.

Every function bundling `_shared/openrouter.ts` has since been redeployed from a
clean checkout, so no stale copy of it is left in production:

| Function | Version | Calls `completeStructured`? |
|---|---|---|
| `generate-outfits` | **40** | yes — the reported failure |
| `tag-item` | **40** | yes |
| `stylist-chat` | **36** | yes |
| `packing-brief` | **30** | yes |
| `parse-closet` | **24** | yes |
| `garment-search` | **43** | no — own provider, constructs `OpenRouterError` |
| `build-export` | **22** | no — imports `redactUrls` only |

All ACTIVE, all `verify_jwt` unchanged, each bundle byte-identical to committed
main, each observed booting in the edge runtime with no `BootError`. The last two
were not functionally affected; they were redeployed so that "which functions
carry the fix" stops being a question anyone has to answer per function.

Redeploying them also shipped two changes that were committed but never
deployed: `_shared/input-bounds.ts` (bounded `nameOptions` validation, already
live via `generate-outfits`) and `build-export/mail.ts` (Resend status and error
class, redacted). Both reviewed, both on green CI.

## Incident, recorded because it touched production

The first deploy attempt shipped **another lane's uncommitted work**.
`supabase functions deploy --use-api` uploads from disk, and
`supabase/functions/_shared/outfit-schema.ts` was modified in the working tree
between this lane's commit and the deploy — swapNote prompt and schema-description
changes that are not in git. Those reached production as **v39**.

Corrected within minutes by redeploying from a clean checkout of `c86be8d`:
**v40** is byte-identical to committed main and contains none of it. The working
tree was left exactly as found — that change and its new
`tests/outfit-swap-note.test.ts` are untouched and still uncommitted, for their
author to land normally.

Lesson for anyone deploying from this checkout: `--use-api` reads the working
tree, not `HEAD`. Deploy from a clean clone at the reviewed commit, or verify
`git status` is clean immediately before the upload.
