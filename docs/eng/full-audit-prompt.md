# Full-app audit, fix and ship — directive for Fable 5.1

Paste everything below the line into Claude Code at the repo root.

---

Do a complete pass over this entire application — correctness, quality, performance — and
then ship the fixes. Every screen, every control, every algorithm, every failure path.
Find what is broken, what is dead, what is wrong, what is slow, and what is merely shabby,
then fix it and get it to users.

I am not going to tell you how to run it. You know how to audit a codebase better than I
know how to describe it, and a checklist from me would only narrow what you look at. Work
it however you want. What follows is context you would otherwise have to discover, plus
the small number of things I actually care about.

## Read first

`docs/marketing/cmo-briefings/METHODOLOGY.md`, and the two most recent briefings in that
directory. This is a live App Store app with real users, and those files are where its
defects, its measurement traps, and its open questions are already written down. The
open `A`-rows in `LEDGER.md` are real findings with evidence attached — fold them into
whatever you produce rather than rediscovering them.

## Use subagents, and choose the model for the job

You are the orchestrator; don't do this all in one context. Fan out, keep the synthesis.

- **Sonnet for breadth.** The mechanical, high-volume sweeps where the answer is a list —
  route and component inventory, enumerating every interactive element, cross-referencing
  analytics events, empty/loading/error-state passes, accessibility labels, orphan
  detection. Send these in parallel, several at a time.
- **Opus for depth.** Anywhere being wrong is expensive or the reasoning is subtle — the
  algorithmic core, migrations and their rollbacks, RLS and data integrity, races and
  lifecycle bugs, and your triage ordering. Especially: any finding where two explanations
  fit the evidence.
- Subagents audit and return findings; **you** write the code, make the calls, and ship.
  For verification, hand the diff to a fresh Opus agent that did not write it and ask it to
  falsify the fix rather than confirm it.

Keep durable notes on disk as you go — findings in a file, not only in context. When this
session compacts, that file is the only thing that survives, and this job is bigger than
one window.

## Things worth knowing about this codebase

Not a task list — just where the bodies are buried, so you don't spend a day rediscovering
them.

- **Dead controls have shipped here before.** `dc26774` left ~10 `Pressable`s with a
  Reanimated wrapper as their only child, so they took no presses at all; `9a2004f` fixed
  it and added a test banning the pattern. That test is the right shape — a button that
  renders and does nothing should fail CI, not wait for a user to notice.
- **Declared-vs-fired analytics is a free dead-code detector.** Diff the events in
  `src/lib/posthog.tsx` against what has actually appeared in production PostHog (project
  544348). `closet_filter` has fired three times in its entire history, which is how a dead
  filter hid for weeks.
- **Predictable server refusals surface as generic error sprays.** The free-tier closet cap
  is enforced as a raw insert rejection: a user who exceeded it got 46 consecutive
  "couldn't add your clothes" errors in 44 seconds, then a paywall ten seconds later. She
  lost the garments and never came back. That pattern is unlikely to be the only one.
- **`outfit_reactions` is written and never read.** 43 reactions from 8 users change
  nothing. Wire it into ranking or delete it and its UI — a thumbs-down that does nothing
  is worse than no thumbs-down.
- **Screens that open to nothing.** `daily_social` is 10 opens, 10 empties, 100%. No error
  event, because nothing is technically broken.
- **Tab `*_opened` events fire on NativeTabs mount unless gated on focus.** More of these
  are `wrong`, not cosmetic — they corrupt the numbers I make decisions from.
- Three runtimes are live in the field. An OTA that misses a fleet is a fix that user never
  gets, and an OTA that published but isn't in production `Application Opened` manifests
  isn't shipped.

## What I care about

**Ship it.** You have autonomy over OTA, migrations, and binary submissions. Apple review
has been running ~15 hours lately, so don't hoard binary-lane work waiting for a big
release. Verify things actually reached devices rather than assuming publish means shipped.

**Don't weaken tests to get green.** If a test fails, the code is wrong or the rule
genuinely changed — and if it's the latter, say so out loud and explain why the old rule
was wrong.

**Tell me what you broke.** A report with no "here's what I nearly got wrong" section is
usually a report that didn't look hard. I'd rather read it than not.

**Surface business decisions, don't make them.** Some things look like bugs and are
actually my call.

## Three things to stop and ask about

Everything else is yours.

1. **The 31 live gifted trials** (`subscriptions.trial_ends_at`). Real people, 22 expiring
   by Sep 11, an email to them already scheduled. Ledger A27. Mine.
2. **Prices, products, and which plan gates which feature.** Fixing a broken paywall
   mechanism is yours; deciding what to charge for isn't. Same for store-listing copy —
   `promotionalText` is a marketing variable currently under test.
3. **Irreversible migrations or anything that deletes user data.** Write the
   down-migration or don't write the migration.

## One standing warning

Two days ago a fix went to three fleets — a ten-minute paywall grace after import failures
— recommended from a single user's data, and it is now suspected of being wrong, because a
second user's failures had the opposite cause. A fix that isn't grounded in which failure
mode actually dominates is a guess wearing a commit message. When two explanations fit, say
so and go get the data that separates them.
