# CI "deployment failed" emails — diagnosis

Investigated 2026-08-06. Repo `nelsonsaenz1/cinch`, default branch `main`.
Diagnostic only — nothing was fixed, re-run, pushed, or changed.

## 1. Verdict

**Nothing is broken right now, and nothing on the deploy path was ever
involved.** At the time of this investigation there was no Vercel git
integration (it was reconnected the same day, 2026-08-06, after this
diagnosis — see the note under §5 "Anything Vercel"), no GitHub Pages site,
and the GitHub Deployments API returned an empty list — so the emails were not
deploy failures at all. They are ordinary GitHub Actions *run failure* notifications
from the single workflow in this repo, `CI`, which GitHub titles in a way that
reads like a deployment. Those emails came from two unrelated things. The bulk
of them — sixteen consecutive red runs on `main` across 2026-08-05 — were all
the same job, `database`, failing at the `RLS and storage policy tests` step:
the pgTAP suite could not get past its own fixture setup, then hit a run of
missing `service_role` grants. **That was already fixed yesterday at 23:19Z**,
and the `database` job has since gone green fourteen runs in a row, now running
the full seven-file, 100-test suite. The one remaining red run is today's most
recent (`31117133351`, commit `ccb0c29`), and it is **not a code failure at
all**: both jobs died in `Set up job` before checking out a single file, with
`Failed to resolve action download info. Error: Service Unavailable`. GitHub
Status confirms a **Major Actions incident that opened at 15:22:49Z today**,
twenty minutes before that run started. The commit it was testing adds a JPEG
and a markdown manifest and nothing else. The correct response to that run is
to re-run it once GitHub's incident closes; there is no code to change. The
only genuinely actionable item found anywhere is pre-emptive: three pinned
actions are on the deprecated Node 20 runtime and are already being force-run
on Node 24, which will become a hard failure when GitHub removes the shim.

## 2. Failure table

| # | Workflow | Job / step | Failure rate | First seen | Root cause | Severity |
|---|---|---|---|---|---|---|
| A | CI | `database` → `RLS and storage policy tests` | 12/12 runs on `main` in window | 2026-08-05 03:45Z (`30973170197`) | pgTAP fixture inserted a `profiles` row that already existed → `duplicate key … profiles_pkey`; every file aborted at setup, 0 of 37 tests ran | **Resolved** |
| B | CI | `database` → `RLS and storage policy tests` | 3/3 runs | 2026-08-05 22:43Z (`31053803040`) | `relation "public.instances" does not exist` + `permission denied for table items` — suite depended on platform default grants that were never written down | **Resolved** |
| C | CI | `database` → `RLS and storage policy tests` | 1/1 run | 2026-08-05 23:15Z (`31055708692`) | residual `permission denied for table items`; storage test 9 "signed-in stranger sees a published derivative" returned 0, wanted 1 | **Resolved** |
| D | CI | `database` (PR #1, `posthog/instrumentation-5a85ce`) | 1/1 run | 2026-08-05 20:38Z (`31045046023`) | Identical to **A**. Branch forked from a red `main`. Not a PostHog bug | **Stale — rebase** |
| E | CI | `check` **and** `database` → `Set up job` | 1/1 run (current) | 2026-08-06 15:43Z (`31117133351`) | GitHub Actions platform outage. `Failed to resolve action download info` / `Service Unavailable` / `Internal Server Error` | **Environmental** |
| F | CI | all jobs (warning only) | every run | ongoing | `actions/checkout@v4`, `actions/setup-node@v4`, `supabase/setup-cli@v1` target Node 20, force-run on Node 24 | **Low, pre-emptive** |

Cancelled runs (six today) are **not failures** — see §5.

## 3. Per-issue detail

### A/B/C — the pgTAP band (already fixed, no action)

All sixteen red runs on `main` yesterday were the same job and the same step.
`check` and `functions` were green throughout; only `database` was red. The
real error lines, not the summaries:

```
psql:supabase/tests/01_rls_baseline.sql:72: ERROR:  duplicate key value
  violates unique constraint "profiles_pkey"
DETAIL:  Key (user_id)=(11111111-1111-4111-8111-111111111111) already exists.
  Parse errors: Bad plan.  You planned 6 tests but ran 0.
```

then later, after partial fixes:

```
psql:supabase/tests/01_rls_baseline.sql:131: ERROR:  relation "public.instances" does not exist
psql:supabase/tests/02_public_boundary.sql:233: ERROR:  permission denied for table items
HINT:  Grant the required privileges to the current role with:
  GRANT SELECT ON public.items TO service_role;
```

and finally:

```
# Failed test 9: "a signed-in stranger sees a published derivative, same as anon"
#         have: 0
#         want: 1
```

This was a live fix session, not a lingering break. The sequence closed with
`5b3f9bd` *"service_role grants written down; the stranger-thumb test joins the
boundary"* at 23:19Z, which went green. **Verification that it is genuinely
fixed and not intermittent:** the `database` job has passed on every run since —
fourteen consecutive greens. The last green run (`31116262013`, commit
`821fda6`, 15:31Z today) shows the complete suite passing, including the three
files added afterwards by the social platform commit:

```
01_rls_baseline.sql ... ok      05_social_graph_boundary.sql ... ok
02_public_boundary.sql ... ok   06_event_boundary.sql .......... ok
03_storage_bucket.sql .... ok   07_social_storage.sql .......... ok
04_plans.sql ............. ok
Files=7, Tests=100  Result: PASS
```

**Fix location: none. Do not dispatch an agent at this.** Files
`supabase/tests/01_rls_baseline.sql`, `02_public_boundary.sql`,
`03_storage_bucket.sql` and the grants migration are already correct on `main`.

### E — today's red run is a GitHub outage (no code fix exists)

Run `31117133351`, commit `ccb0c29`. Both `check` and `database` failed in
`Set up job`, before `actions/checkout` ran — so no repo code was ever
executed. `functions` happened to get its actions cached and passed in 19s,
which is the tell that this is registry-side:

```
15:43:38  Getting action download info
15:45:14  Failed to resolve action download info. Error: Service Unavailable
15:45:14  Retrying in 29.402 seconds
15:47:10  Failed to resolve action download info. Error: Service Unavailable
15:47:10  Retrying in 23.666 seconds
15:49:09  ##[error]Service Unavailable
```

`check` got `Internal Server Error` on its third attempt. Corroborated
externally: githubstatus.com reports **"Incident with Actions", impact Major,
started 2026-08-06T15:22:49Z**, still investigating, describing *"some workflow
runs are failing to start or failing partway through."*

I also confirmed this outage is not masking a real break. Commit `ccb0c29`
touches only `assets/garments/MANIFEST.md` and a new
`assets/garments/cream-crochet-poncho.jpg` — no code. And the two fast checks
that could plausibly be affected both pass locally on the current tree:

- `npm test` → 69 tests, 68 pass, 1 skipped, 0 fail
- `npm run smoke:styling` → passes (its fixture closet is 22 items and is
  independent of `assets/garments/`)

Combined with `npx tsc --noEmit` and `npx expo lint` already being clean,
`main` is healthy. **Fix: re-run the workflow after GitHub's incident closes.
No file changes.**

### F — Node 20 action deprecation (the only real repo change)

Every run carries this annotation:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are
> being forced to run on Node.js 24: `actions/checkout@v4`,
> `actions/setup-node@v4`, `supabase/setup-cli@v1`.

Today it is a warning because GitHub silently upgrades the runtime. When that
shim is removed these jobs stop starting. Current upstream latest:

| Action | Pinned in `ci.yml` | Latest | Occurrences |
|---|---|---|---|
| `actions/checkout` | `v4` | `v7.0.1` | 3 (lines in `check`, `database`, `functions`) |
| `actions/setup-node` | `v4` | `v7.0.0` | 1 (`check`) |
| `supabase/setup-cli` | `v1` | `v3.0.0` | 1 (`database`) |
| `denoland/setup-deno` | `v2` | `v2.0.5` | 1 — already current, leave alone |

**Fix location:** `/Users/nelsonsaenz/cinch/.github/workflows/ci.yml`, the
`uses:` lines only. Bump the three deprecated pins; leave `denoland/setup-deno@v2`
alone. `supabase/setup-cli` v1 → v3 is a major bump and is the one to watch —
the workflow relies on `supabase db start`, `supabase test db` and
`supabase stop --no-backup`, so the resulting run must be observed green before
this is considered done, not merged on the strength of the diff.

## 4. Dispatch plan

Being honest about scope: **there is exactly one file worth changing in this
entire investigation.** Manufacturing parallel batches here would be theatre —
so this is one batch plus two explicitly-empty ones, and the zero-overlap
guarantee is trivially satisfied.

### Batch 1 — Action runtime deprecation (the only code work)

- **Owns, exclusively:** `.github/workflows/ci.yml`
- **Task:** bump `actions/checkout@v4` → `@v5` or later (3 occurrences),
  `actions/setup-node@v4` → `@v5` or later (1 occurrence), `supabase/setup-cli@v1`
  → `@v3` (1 occurrence). Do not touch `denoland/setup-deno@v2`. Do not alter
  job structure, step order, the `concurrency` block, or any `run:` body.
- **Acceptance:** the Node 20 annotation is gone and the `database` job still
  reports `Files=7, Tests=100  Result: PASS`.
- **Blocked until:** the GitHub Actions incident closes — otherwise the
  verification run cannot be trusted.

### Batch 2 — *(empty)*

No second batch exists. Issues A, B and C are already fixed on `main`; issue E
has no code fix. Any agent dispatched at `supabase/tests/` or
`supabase/migrations/` would either re-break working code or collide with the
concurrent session (§5).

### Batch 3 — *(founder action, not an agent)*

Re-run workflow `31117133351` once githubstatus.com shows Actions green. This
is a click, not a code change. **No secrets are involved anywhere in this
repo's CI** — the `database` job is entirely local to the runner (the workflow
comments note "No remote project and no secrets are involved"), and the only
env var in play is `SUPABASE_INTERNAL_IMAGE_REGISTRY: ghcr.io`. Nothing here
is a missing or expired credential, and nothing needs to be set anywhere.

**File-overlap check:** Batch 1 owns `.github/workflows/ci.yml` and nothing
else. No other batch owns any file. Overlap is zero by construction.

## 5. Do NOT fix

- **The pgTAP suite** (`supabase/tests/01`–`07`, and the grants migration).
  Fixed yesterday, green fourteen runs running. Pointing an agent at
  yesterday's error text would regress working code.
- **The concurrent session's in-flight work.** Confirmed *not* implicated in
  any CI failure — these files are untracked, so CI has never seen them, and no
  run log anywhere references `08_ugc_moderation` or `social_terms_version`.
  Leave alone: `supabase/migrations/20260808100000_ugc_text_filter.sql`,
  `supabase/migrations/20260808101000_social_terms_gate.sql`,
  `supabase/tests/08_ugc_moderation.sql`,
  `src/features/auth/use-social-terms.ts`,
  `src/components/social/social-terms-sheet.tsx`. When that session commits,
  `08_ugc_moderation.sql` becomes the eighth pgTAP file and
  `use-social-terms.ts` will fail typecheck until the generated types are
  regenerated — that is their job, on their schedule.
- **The cancelled runs.** Six runs today show `cancelled`, which looks alarming
  in the Actions tab but is the `concurrency: cancel-in-progress: true` block
  working exactly as designed during the six-batch merge train. GitHub does not
  email on cancellation, so these are not the founder's emails. I verified
  there is **no coverage gap**: all six cancelled commits (`3c51e6a`, `1ef7262`,
  `5bbd1c3`, `de9c2d9`, `4ed31ee`, `3e57f62d`) are ancestors of `821fda6`,
  which ran the full suite green. Do not "fix" the concurrency config.
- **PR #1 on `posthog/instrumentation-5a85ce`.** Its red run is issue A,
  inherited from a `main` that was broken at the time it branched. It needs a
  rebase onto current `main`, not a code fix. Note there are two PostHog
  branches on the remote (`posthog/instrumentation-5a85ce` and
  `posthog/instrumentation-gaps`) — confirm with that session which is live
  before touching either.
- **Anything Vercel.** At investigation time there was no git integration, no
  Deployments API entries, and no Pages site — the marketing site in `web/`
  deployed only by manual `vercel --prod`, and no email in this batch came
  from Vercel. **Update, 2026-08-06:** the Vercel git integration was
  reconnected the same day, with Root Directory set to `web`. That changes the
  premise of this line for anything investigated *after* the reconnect — a
  push to `main` now triggers a real Vercel deployment, and a failure there
  would be a genuine deploy-failure email, not a mislabelled Actions run. This
  report's verdict still holds for the runs it covers, all from before the
  reconnect.

## Appendix — evidence

- Failing run (current): `gh run view 31117133351 --log-failed`
- Last fully green run: `gh run view 31116262013 --log`
- Representative issue-A run: `gh run view 31010392709 --log-failed`
- Issue-B run: `gh run view 31053803040 --log-failed`
- Issue-C run: `gh run view 31055708692 --log-failed`
- Outage corroboration: `https://www.githubstatus.com/api/v2/incidents.json`
- Deployments / Pages checked empty: `gh api repos/nelsonsaenz1/cinch/deployments`,
  `gh api repos/nelsonsaenz1/cinch/pages` (404)
