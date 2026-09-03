# Preamble for the 2026-09-02 visual/usability directive implementation agents

You are implementing part of the founder's whole-app visual and usability audit
(the numbered findings are in the task you were given). Repo: an Expo 57 /
React Native 0.86 / NativeWind / Reanimated 4.5 iOS app.

Ground rules (non-negotiable):
- Work ONLY in your git worktree (given in the task). Symlink node_modules from
  /Users/nelsonsaenz/cinch/node_modules into the worktree (`ln -s`) so
  `npm run typecheck`, `npm test`, `npm run lint` run. Never publish, never touch
  EAS, Supabase, migrations, prices, plan gating, store listing copy, or the
  `subscriptions` model. No new dependencies (package.json is a native
  fingerprint input — changing it forces a store build).
- Design language: serif display (`Text variant="display|title"`), neutral
  canvas, oxblood accent, one primary action per zone, short headline → one-line
  consequence → optional detail behind a disclosure. Read src/theme/tokens.ts,
  src/components/ui/* (Button, Text, ErrorState, EmptyState, ScreenHeader,
  SectionHeader, NoticeBand, Skeleton) and reuse them. Copy is American,
  plain, no exclamation marks; the app never uses the word "user".
- Dynamic Type: never fixed-height text containers; let text grow; keep sticky
  controls clear of the tab bar (use safe-area insets and measured footer
  heights — see how capture.tsx measures its panel). Test mentally at AX5.
- Every pressable keeps its own style (tests/pressable-shape.test.ts bans a
  bare Pressable wrapping a Reanimated view). Every icon-only control has an
  accessibilityLabel. Every route-level error/empty state has a way back and,
  where it makes sense, a retry.
- Analytics: only events declared in src/lib/posthog.tsx; bounded properties.
- Existing tests pin copy in many places (tests/*.test.ts read source or import
  spec modules). When a test pins the exact thing the directive tells you to
  change, update the test AND say so in your report with the old rule and why
  it changed. Do not weaken unrelated tests.
- Keep the diff focused on your cluster. Commit on your worktree branch with a
  clear message; do not push. Run `npm run typecheck && npm test && npm run
  lint` before reporting; report the real output.
- Report: what you changed (file:line), what you deliberately did not do and
  why, anything that is a founder/taste decision rather than a defect, and
  any test you changed.
