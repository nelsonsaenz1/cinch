# Cinch

An iOS wardrobe app. You photograph your clothes once; Cinch tags them, and from
then on it tells you what to wear — for today's weather, today's calendar, what
you actually reach for, and now who you're actually seeing. Post a dinner, invite
your friends, and everyone pins outfit options from her own closet for the others
to vote on. Borrow the piece you don't own from someone who does. See, in numbers,
what you actually wear and what's been sitting there since March.

The part that matters is that **the styling is not an API call**. Outfit
generation is a deterministic engine that runs on the phone: perceptual colour
maths in OKLCH, a beam search over the closet, and a linear model over named
features that learns from every thumbs-up. It works offline, it costs nothing
per outfit, and every recommendation decomposes into a reason you can argue
with. A language model is used only for the two things it is genuinely better
at — reading a photograph of a garment, and writing a sentence about a look the
engine already chose. The same discipline holds for the social layer: every
outfit a friend votes on is real, from a real closet, chosen against her own
other options — never a leaderboard, never a stranger, never a feed of clothes
nobody owns. See `docs/social/product-spec.md` for the full spec.

## Architecture

```
src/
  app/            expo-router routes; (tabs) is Today / Closet / Plan
  components/     presentational, grouped by the screen that owns them
  features/       hooks, queries and mutations, grouped by domain
  lib/
    color/        sRGB <-> OKLab <-> OKLCH, hue families, harmony scoring
    styling/      garment projection, scoring rules, beam search, learning
    shopping/     wardrobe gap analysis
  schemas/        zod schemas at every trust boundary
  theme/          design tokens
supabase/
  migrations/     schema and row level security, applied in filename order
  functions/      Deno Edge Functions (tag-item, generate-outfits,
                  stylist-chat, delete-account)
  tests/          pgTAP RLS and storage policy tests
tests/            unit tests for the pure logic
scripts/          smoke tests, test runner, font and simulator helpers
web/              the static marketing, privacy and support site
```

Three boundaries are worth knowing before changing anything:

- **The engine is pure.** Everything under `src/lib/` takes data and returns
  data — no React, no network, no clock except the `now` passed into the
  context. That is what makes it testable, and the tests in `tests/` are the
  contract.
- **The model never sees your closet — with one stated exception.** Edge
  Functions receive a shortlist the device already generated, not the wardrobe.
  The API key lives in Edge Function secrets and is never referenced from client
  code. The exception is voice intake: if you describe your closet out loud, the
  recording is transcribed by a model and then deleted, and the transcript is
  parsed by a model into garments. That path is opt-in, it is the only one where
  a model receives your wardrobe rather than a shortlist, and the audio does not
  outlive the transcription — see `docs/design/voice-intake-directive.md` §8.
- **Row level security is the security model.** There is no server-side
  authorization layer to fall back on. Public data is exposed *only* through the
  allowlisted projection views (`public_profiles`, `public_items`,
  `public_outfits`, `public_outfit_items`, `public_like_counts`) — never the
  base tables. `supabase/tests/` is what holds that line.

## Prerequisites

- Node 22
- Xcode with an iOS 26 simulator runtime (this is a development build, not Expo
  Go — the app uses native modules Expo Go does not ship)
- [Supabase CLI](https://supabase.com/docs/guides/local-development) for
  migrations and the database tests
- Docker, for `supabase db start`

## Environment

Copy the template and fill it in. Names only below — never commit values.

```bash
cp .env.example .env.local
```

| Variable | Where | What |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | `.env.local` | Project URL. Inlined into the bundle. |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` | Publishable (anon) key. Public by construction — RLS is what protects the data, not this key. |
| `OPENROUTER_API_KEY` | Supabase Edge Function secrets | Model access. Never in the app bundle, never in this repo. |

`EXPO_PUBLIC_*` is compiled into the JavaScript bundle and is readable by anyone
with the `.ipa`. If a value must stay secret, it belongs in Edge Function
secrets and behind a function.

## Setup and run

```bash
npm ci
npx expo run:ios          # first run builds the native project
npm start                 # subsequent runs
```

`./scripts/run-ios.sh` wraps the same thing with the simulator-runtime repair
this machine has historically needed; read the header comment before running it,
since the first step uses `sudo`.

## Checks

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` over the app. Edge Functions are excluded — they are Deno. |
| `npm run lint` | ESLint via `expo lint`. |
| `npm test` | Unit tests: styling engine invariants, colour maths, cost-per-wear, date keys. |
| `npm run test:db` | pgTAP tests against a local Supabase. Requires `supabase db start`. |
| `npm run smoke:styling` | Prints real outfits and colour pairings for a human to eyeball. |
| `npm run smoke:type` | Typographic scale and font-metric check. |

All of these run in CI (`.github/workflows/ci.yml`), plus a full iOS bundle —
which catches the failure typecheck cannot: a module that resolves at compile
time and then blows up when Metro bundles it for the device.

### About the unit tests

There is no Jest. The things worth testing here are pure functions, and Node 22
ships a test runner; `scripts/run-tests.mjs` bundles each `tests/*.test.ts` with
esbuild (already a dependency) and hands the results to `node --test`.

A test may be written before the module it covers exists. Such a file is named
`*.test.ts.pending` with a `// requires: <path>` header — the extension keeps it
out of `tsc`, and the runner promotes it to a real test automatically once its
dependency lands.

### About the database tests

`supabase/tests/*.sql` are pgTAP, run by `supabase test db` against a local
Postgres with every migration applied. They exercise four roles — `anon`, the
owner, an unrelated authenticated user, and `service_role` — across every table
and the storage bucket. They are the only check in the project that can see a
broken RLS policy: a policy that leaks the whole table still typechecks, still
bundles, and still ships.

## Database workflow

```bash
supabase db start                          # local Postgres, migrations applied
supabase migration new <name>              # write SQL by hand; no diffing
supabase test db                           # prove the policies still hold
npm run gen:types                          # regenerate src/types/database.ts
supabase db push                           # apply to the linked project
```

Migrations are append-only and applied in filename order. Never edit one that
has been pushed — write another.

`npm run gen:types` regenerates the TypeScript row types for both the app and
the Edge Functions from the linked project, so run it after every schema change
or the types quietly describe the old schema.

## Release

Builds go through EAS; profiles are in `eas.json`.

```bash
eas build --profile development --platform ios   # simulator dev client
eas build --profile preview --platform ios       # internal distribution
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

`production` uses `autoIncrement` with `appVersionSource: remote`, so the build
number comes from EAS rather than from the repo. The App Store listing copy
lives in `docs/app-store-listing.md`, and the marketing and legal pages served
alongside it are in `web/`.

## Licence

MIT — see `LICENSE`.
