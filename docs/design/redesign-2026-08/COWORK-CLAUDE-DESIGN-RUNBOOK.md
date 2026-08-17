# Operator runbook — driving Claude Design in Chrome for the Cinch redesign

**For any browser-driving agent (written for Grok bot) operating Nelson's
signed-in Chrome. Everything happens in Chrome; the only handoff out is
files landing in `~/Downloads`, which Claude Code (the desktop app session)
ingests and builds automatically. Nelson is away from the computer — this
pipeline must run for hours without him.**

Pairs with `DIRECTIVE.md` in this folder: that file holds the design law (§1)
and the 30 page briefs (§3). This file holds the mechanics. Never restate or
improvise the briefs; paste them.

The receiving side, already armed: Claude Code scans every 15 minutes, ingests
correctly-named files from `~/Downloads` into
`/Users/nelsonsaenz/cinch/design-refs/redesign-2026-08/<page>/`, and — when a
page's set is complete — dispatches an Opus 5 / Sonnet 5 implementation fleet
to build it exactly to frame, verify (typecheck, tests, lint, adversarial
review), and ship it OTA to Nelson's phone. Your entire job is producing
excellent, complete, correctly-named page sets.

---

## 1 · Where to work

- In Chrome: `https://claude.ai/design` (Nelson is signed in).
- First page you make creates the project; keep every subsequent page in the
  SAME project — name it **Cinch Redesign 2026-08** if the UI offers naming.
- Never open or edit the existing projects (`Cinch Mobile App`,
  `Cinch Daily Social Atlas`, `Cinch UI Excellence Atlas`) — they are records.
  Read-only glances are fine.
- Model selector: **Opus 5** (highest available). Design system selector:
  leave **None** — the prompt carries Cinch's real system; the stock presets
  would fight it.

## 2 · The prompt, per page

Paste three blocks as ONE message, in this order:

1. **The design law** — `DIRECTIVE.md` §1 ("warm paper, turned up"),
   verbatim, every page (each canvas is a fresh context).
2. **The page brief** — that page's numbered entry from `DIRECTIVE.md` §3,
   verbatim, including its "Keep" clause.
3. **The state demand**, always:

   > Design this as an iPhone screen (393pt width). Produce EVERY state as a
   > separate labeled frame: default with realistic Cinch data (real-length
   > names like "Alexandria's birthday dinner at Contramar"), empty, loading,
   > error, largest accessibility text size, and keyboard-open where the page
   > has input. Instrument Serif for display type, Helvetica Neue for
   > everything small, on the warm paper palette (#FBFAF6 canvas, #1C1A16
   > ink, #6E2B2B oxblood, #B08A76 clay, #F7EDE8 blush, #F0ECE3 tray,
   > #EAE5DB sand, #6B665C muted). Label each frame with its state name.

## 3 · Iterate before accepting — you are the taste gate now

Nelson has delegated the per-frame approval to this pipeline; he judges the
built result on his phone. That makes your QA pass load-bearing. After the
first render, critique and re-prompt (2–3 rounds is normal) until ALL of
these hold:

- [ ] Reads as *designed*, not typeset — confident tinted fills, image-forward,
      would not be mistaken for a settings page.
- [ ] Serif display + Helvetica small text only; palette hexes only; no
      stray blues/grays/gradients off-palette.
- [ ] Every demanded state exists and is labeled; no state is a gray box
      placeholder.
- [ ] No text collides or overlaps at the long-name test data; AX frame is
      genuinely larger type, still usable.
- [ ] The brief's "Keep" clause is intact (privacy lines, quota truths,
      dismissibility). If the design violates it, fix the design — the
      constraint is law, not taste.
- [ ] One coherent primary action; touch targets read ≥44pt.

Useful re-prompt lines: "More color confidence — tint the section headers and
selected states with clay/blush instead of gray." · "Bigger imagery, tighter
gutters." · "The empty state should draw the object, not explain it." ·
"Cut every sentence that restates what the layout already shows."

## 4 · Export and handoff — naming is the contract

When a page passes §3, download/export from Chrome into `~/Downloads`
(default download location — do not change it). **Exact names, lowercase:**

```
cinch-<page>-artifact.html        the full self-contained artifact HTML
cinch-<page>-default.png          one PNG per labeled state frame
cinch-<page>-empty.png
cinch-<page>-loading.png
cinch-<page>-error.png
cinch-<page>-ax.png
cinch-<page>-keyboard.png         only where relevant
cinch-<page>-HANDOFF.txt          see §5 — required
cinch-<page>-DONE.txt             the completion slip — LAST file, see below
```

`<page>` is the directive's slug: `01-plan-week`, `02-new-event`,
`03-event-detail`, `04-trips-list`, `05-new-trip`, `06-trip-detail`,
`07-profile`, `08-friends-list`, `09-people-search`, `10-invite-share`
(Wave 1), then `11-today` … `30-membership` per the directive.

How to get the files: use the artifact's download/export control if present;
otherwise copy the artifact code into a saved `.html` file, and screenshot
each state frame full-height for the PNGs. PNGs of every state are REQUIRED
even when the HTML exists — the fleet builds from both.

**`cinch-<page>-DONE.txt`** is written only after every other file for that
page is fully downloaded (a half-downloaded set must never build). Its
content: one line per §3 checklist item confirming it holds, plus anything
you deviated from in the brief and why. The ingester treats DONE.txt as the
build trigger; no DONE.txt, no build.

## 5 · The handoff note — write it thorough (`cinch-<page>-HANDOFF.txt`)

This is your prompt TO Claude Code's build fleet. The artifact shows *what*;
this note states *what the picture can't*. Include, in plain text:

1. **Frame inventory** — each state frame's label and one line on what it shows.
2. **Behavior** — every interaction the design implies: what appears/disappears
   (e.g. invite rows hide on typing), what each tap does, where each control
   navigates, which moments get haptics, any animation (what enters, how,
   roughly how long).
3. **Exact copy** — every visible string, listed, so the builder types none
   from memory.
4. **Structure walk** — top to bottom: section by section, what fills it,
   which palette color each fill/accent uses, which font class each text
   plays (display serif / heading / body / small label).
5. **Data notes** — which parts are real user data vs. static; anything the
   design assumes the backend has (flag anything that smells new — the fleet
   checks it against the real schema).
6. **Deviations** — anything in the artifact that differs from the brief, and
   whether it was deliberate.

## 6 · Order of work, and pace

Wave 1 first, in this order: `09-people-search`, `02-new-event`,
`01-plan-week`, `03-event-detail`, `04-trips-list`, `05-new-trip`,
`06-trip-detail`, `07-profile`, `08-friends-list`, `10-invite-share`.
Then Wave 2 (`11`–`17`), then Wave 3 (`18`–`30`) — continue without waiting
for anyone. Finish one page COMPLETELY (all files + DONE.txt) before starting
the next: one shipped page per cycle beats five half-exported ones. Budget
roughly 20–40 minutes of iteration per page; do not gold-plate past the §3
checklist.

## 7 · Rules and stop conditions

- Chrome only, claude.ai/design only. Do not touch other Claude surfaces,
  other tabs' work, email, or any other site.
- Never invent data fields, prices, quotas, or privacy behavior. Briefs'
  "Keep" clauses win over any design instinct.
- If a design needs a native module (maps, video, live camera preview beyond
  what exists), still export it, and add the line `NEEDS-NATIVE` at the top
  of DONE.txt — Claude Code will route it to a binary build instead of OTA.
- If claude.ai logs out, rate-limits, asks for payment, or shows new terms:
  stop and leave a note for Nelson. Do not work around auth.
- Never delete or rename files already in `~/Downloads` that you did not
  create this session.
- If the Design UI fails on an export, re-try once, then fall back to
  copy-the-code + screenshots (§4) rather than stalling the page.

## 8 · What happens after you (so you can state it in your reports)

Claude Code's 15-minute watcher ingests each complete set from `~/Downloads`
into the repo, then Fable (the orchestrator) dispatches Opus 5 builders and
Sonnet 5 auditors: build exactly to frame (§0 of `DIRECTIVE.md` — deviations
only where iOS forces them, each one listed), typecheck + full test suite +
lint + adversarial diff review, commit, push, OTA via `npm run release:ota`,
and a ledger entry in `BUILD-LEDGER.md`. Nelson sees each page on his phone
roughly 30–60 minutes after your DONE.txt lands. Nothing you export is ever
built twice.
