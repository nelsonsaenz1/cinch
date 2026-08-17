# Operator runbook — ChatGPT driving the Cinch redesign pipeline

**For ChatGPT operating Nelson's Mac by computer use. You run two apps and
nothing else: Chrome (claude.ai/design, signed in) and the Claude desktop
app (Claude Code, session open in `/Users/nelsonsaenz/cinch`). Nelson is
away for hours — the two of you finish this without him.**

Your three jobs, in a loop until all pages are done:
1. **Prompt** Claude Design in Chrome to design one page, iterate until it
   passes the QA checklist, and export the files.
2. **Hand off** to Claude Code by typing a build message into its prompt
   box in the desktop app.
3. **Monitor** Claude Code while it builds — answer its questions, confirm
   each page ships — while you already work the next page in Chrome.

Two reference files (also copies on the Desktop):
- `/Users/nelsonsaenz/cinch/docs/design/redesign-2026-08/DIRECTIVE.md` —
  the design law (§1) and the 30 page briefs (§3). You paste from it
  verbatim; never restate or improvise a brief.
- This file — the mechanics.

---

## 1 · Where to work

- Chrome tab: `https://claude.ai/design`. Project **Cinch Redesign
  2026-08** (create it if the first prompt asks; reuse it for every page).
  Never open or edit the older projects (Cinch Mobile App, Cinch Daily
  Social Atlas, Cinch UI Excellence Atlas) — records, read-only.
- Model selector: **Opus 5** (highest available). Design system: **None**
  — the prompt carries Cinch's real system.
- Claude desktop app: the existing Claude Code session in the `cinch`
  folder. Type into its prompt box only; never open menus, settings, or
  other sessions.

## 2 · The prompt, per page

Paste three blocks as ONE message into Claude Design:

1. **The design law** — DIRECTIVE.md §1, verbatim, every time (each canvas
   is a fresh context).
2. **The page brief** — that page's numbered entry from DIRECTIVE.md §3,
   verbatim, including its "Keep" clause.
3. **The state demand**, always:

   > Design this as an iPhone screen (393pt width). Produce EVERY state as
   > a separate labeled frame: default with realistic Cinch data
   > (real-length names like "Alexandria's birthday dinner at Contramar"),
   > empty, loading, error, largest accessibility text size, and
   > keyboard-open where the page has input. Instrument Serif for display
   > type, Helvetica Neue for everything small, on the warm paper palette
   > (#FBFAF6 canvas, #1C1A16 ink, #6E2B2B oxblood, #B08A76 clay, #F7EDE8
   > blush, #F0ECE3 tray, #EAE5DB sand, #6B665C muted). Label each frame
   > with its state name.

**Waiting:** Claude Design takes several minutes per generation. Do not
re-prompt while it is still generating. While waiting, use the time to
check the Claude desktop app (§6).

## 3 · Iterate before accepting — you are the taste gate

Nelson judges the built result on his phone; your QA pass is the only
review before code. After the first render, critique and re-prompt (2–3
rounds is normal) until ALL hold:

- [ ] Reads as *designed*, not typeset — confident tinted fills,
      image-forward, would never be mistaken for a settings page.
- [ ] Serif display + Helvetica small text only; palette hexes only; no
      stray blues/grays/gradients.
- [ ] Every demanded state exists, labeled, none a gray placeholder.
- [ ] No text collides at the long-name test data; AX frame is genuinely
      larger type and still usable.
- [ ] The brief's "Keep" clause is intact (privacy lines, quota truths,
      dismissibility). If the design violates it, fix the design — the
      constraint is law, not taste.
- [ ] One coherent primary action; touch targets read ≥44pt.

Useful re-prompt lines: "More color confidence — tint section headers and
selected states with clay/blush instead of gray." · "Bigger imagery,
tighter gutters." · "The empty state should draw the object, not explain
it." · "Cut every sentence that restates what the layout already shows."

## 4 · Export the files

When a page passes §3, download into `~/Downloads` (default location —
do not change it). **Exact names, lowercase:**

```
cinch-<page>-artifact.html      the full self-contained artifact HTML
cinch-<page>-default.png        one PNG per labeled state frame
cinch-<page>-empty.png
cinch-<page>-loading.png
cinch-<page>-error.png
cinch-<page>-ax.png
cinch-<page>-keyboard.png       only where the page has input
```

`<page>` is the directive's slug: `01-plan-week`, `02-new-event`,
`03-event-detail`, `04-trips-list`, `05-new-trip`, `06-trip-detail`,
`07-profile`, `08-friends-list`, `09-people-search`, `10-invite-share`,
then `11-today` … `30-membership`.

How: use the artifact's download/export control if present; otherwise copy
the artifact code into a saved `.html` file, and screenshot each state
frame full-height for the PNGs. PNGs of every state are REQUIRED even when
the HTML exists.

**Do NOT write DONE.txt or HANDOFF.txt files** (those belong to the old
pipeline). Your handoff is the message in §5. Never delete or rename
Downloads files you did not create.

## 5 · The handoff message — typed into Claude Code's prompt box

Switch to the Claude desktop app, click the prompt box, and type ONE
message. Press Enter once — the message sends and queues even if Claude
Code is mid-build. Format:

```
BUILD <page-slug>

Files (in ~/Downloads): <list every file you exported>
NEEDS-NATIVE: yes/no  (yes only if the design needs a native module —
maps, video, live camera — beyond what the app has)

FRAMES: each state frame's label + one line on what it shows.
BEHAVIOR: every interaction the design implies — what appears/disappears,
what each tap does, where each control navigates, which moments get
haptics, any animation (what enters, how, roughly how long).
COPY: every visible string, listed exactly, so the builder types none
from memory.
STRUCTURE: top to bottom, section by section — what fills it, which
palette color each fill/accent uses, which type role each text plays
(display serif / heading / body / small label).
DATA: which parts are real user data vs static; anything the design
assumes the backend has (flag anything that smells new).
DEVIATIONS: anything that differs from the brief, and whether deliberate.
```

Write it thorough — this message is the build fleet's spec.

**What Claude Code does with it (so you know what to expect and verify):**

1. Ingests the files from `~/Downloads` into the repo.
2. Dispatches Opus 5 builder agents + Sonnet 5/Opus 5 adversarial
   reviewers to build exactly to frame.
3. Verifies: typecheck, full test suite, lint, adversarial diff review.
4. **Runs the app in the iOS Simulator and screenshots the rebuilt page**
   — no page ships unseen.
5. Commits, pushes, ships via EAS OTA (`npm run release:ota`), and
   **verifies the update actually published to the store build's runtime**
   — not just that the command ran.
6. If the page needed native changes (NEEDS-NATIVE yes, or the
   fingerprint check fails), Claude Code runs a full EAS build and
   TestFlight submission instead of OTA, and says so.
7. Records the page in `docs/design/redesign-2026-08/BUILD-LEDGER.md`
   and replies with a **SHIP REPORT**: commit hash, OTA update ID (or EAS
   build ID), and confirmation the simulator screenshot matched the
   artifact.

A page is NOT done until you have seen its SHIP REPORT. A build with no
ship report is the exact failure this pipeline exists to kill — chase it
(§6), never assume it shipped.

Then go straight back to Chrome and start the next page.

## 6 · Monitor Claude Code (the whole time)

Check the Claude desktop app roughly every 10 minutes, and whenever
Claude Design is generating:

- **Do not stop for approvals.** Nelson has pre-authorized this entire
  pipeline. Answer Claude Code's questions yourself from DIRECTIVE.md,
  this runbook, or the artifact — decisively, without deferring. The ONLY
  things that hold for Nelson: spending new money, account credentials,
  and deleting user data. Everything else, decide and move.
- **If a permission dialog appears in the desktop app**: approve it —
  builds, file edits, git push, EAS/OTA commands, simulator control, test
  runs are all pre-authorized. Decline only credential prompts or
  anything reaching outside the project, Downloads, EAS, and the
  simulator.
- **If Claude Code sends a SHIP REPORT**: check it names the page's
  commit AND its OTA update ID (or EAS build ID) AND the simulator
  verification. All three present → mark the page done in your notes.
  Anything missing → reply asking for the missing proof.
- **Be patient.** Claude Design generations take several minutes; Claude
  Code builds take 20–60 minutes per page. Waiting is normal. Only treat
  it as a stall after 45+ minutes of no output on a build: type "status?"
  once. If still stuck 15 minutes later, re-send the §5 message once.
  Never spam, never assume failure early.

Do not type anything into the prompt box except §5 handoffs, answers to
its questions, and a single "status?" per stall.

## 7 · Order of work, and pace

Wave 1 in this order: `09-people-search`, `02-new-event`, `01-plan-week`,
`03-event-detail`, `04-trips-list`, `05-new-trip`, `06-trip-detail`,
`07-profile`, `08-friends-list`, `10-invite-share`. Then Wave 2
(`11`–`17`), then Wave 3 (`18`–`30`). Continue without waiting for
anyone. Finish one page completely (export + handoff message) before
prompting the next; budget 20–40 minutes of iteration per page — do not
gold-plate past the §3 checklist. Claude Code builds pipeline-style
behind you; you never wait for a build to finish before designing the
next page.

**Done means:** every page handed off AND confirmed shipped by Claude
Code (or explicitly parked with a reason). Before you stop, check the
desktop app one last time, wait for the final build confirmation, then
leave a closing message: "All pages handed off. Shipped: <list>.
Parked: <list + why>."

## 8 · Rules and stop conditions

- Two apps only: Chrome (claude.ai/design) and the Claude desktop app.
  No email, no other sites, no other apps, no system settings.
- Never invent data fields, prices, quotas, or privacy behavior. "Keep"
  clauses win over taste.
- If claude.ai logs out, rate-limits, asks for payment, shows a CAPTCHA,
  or shows new terms: stop designing, tell Claude Code via the prompt box
  ("Claude Design is blocked: <why>"), and leave a note for Nelson. Never
  work around auth or CAPTCHAs.
- If the Design UI fails an export: retry once, then fall back to
  copy-the-code + screenshots (§4) rather than stalling the page.
- If the Mac sleeps or Chrome crashes: reopen only the two apps and
  resume where the ledger and your notes say you were.
