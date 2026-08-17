# Runbook — driving Claude Design in the browser for the Cinch redesign

**For a Cowork agent with browser access to Nelson's signed-in claude.ai.**
**Pairs with `DIRECTIVE.md` in this folder — that file holds the page briefs
and the design law; this file holds the mechanics. Do not restate or reinvent
the briefs; paste them.**

A watcher in the main Claude Code session scans
`/Users/nelsonsaenz/cinch/design-refs/redesign-2026-08/` every 15 minutes and
builds whatever lands there. Your entire job is to get approved artifacts into
that folder in the format below. Nothing you produce ships without Nelson's
approval on the frame first.

---

## 1 · Where to work in Claude Design

- Open Claude Design in the signed-in browser (claude.ai).
- **Create a NEW project: "Cinch Redesign 2026-08".** Do NOT edit or overwrite
  the existing project `Cinch UI Excellence Atlas`
  (`49b82198-7610-4896-a8ba-94d44ce76f68`) — it is a frozen, accepted design
  record. Read it if useful; never write to it.
- One canvas (or artifact) per page from the directive, named exactly as the
  directive numbers them: `01-plan-week`, `02-new-event`, `03-event-detail`,
  `04-trips-list`, `05-new-trip`, `06-trip-detail`, `07-profile`,
  `08-friends-list`, `09-people-search`, `10-invite-share`, and onward.

## 2 · What to paste per page

For each page, the prompt to Claude Design is three blocks, in this order:

1. **The design law** — §1 of `DIRECTIVE.md` ("warm paper, turned up"),
   verbatim, once per canvas.
2. **The page brief** — that page's entry from §3 of `DIRECTIVE.md`, verbatim.
3. **The state demand** — always this closing paragraph:

   > Design this as an iPhone screen (393pt width). Produce EVERY state:
   > default with realistic Cinch data (real-length names like "Alexandria's
   > birthday dinner at Contramar"), empty, loading, error, largest
   > accessibility text size, and keyboard-open where the page has input.
   > Use Instrument Serif for display type and Helvetica Neue for everything
   > small, on the warm paper palette (#FBFAF6 canvas, #1C1A16 ink, #6E2B2B
   > oxblood, #B08A76 clay, #F7EDE8 blush, #F0ECE3 tray). Label each frame
   > with its state name.

Iterate inside Claude Design until the page is genuinely good — push it on
composition, color confidence, and image-forward layouts before showing
Nelson. Weak first drafts burn his time.

## 3 · Approval, then export

1. When a page looks strong, show it to Nelson (he is driving or nearby —
   this program's rule is that HE approves every frame before it is built).
2. On approval, export the artifact:
   - Download/copy the artifact's **HTML** (the full self-contained file).
   - Screenshot or export **PNGs of every labeled state frame**.
3. Save into the repo, exactly here:

   ```
   /Users/nelsonsaenz/cinch/design-refs/redesign-2026-08/<canvas-name>/
       artifact.html
       state-default.png
       state-empty.png
       state-loading.png
       state-error.png
       state-ax.png
       state-keyboard.png     (only where relevant)
       APPROVED.md            (one line: date + "approved by Nelson")
   ```

   The `APPROVED.md` file is the build trigger's permission slip — **the
   watcher must not build a folder that lacks it**, and you must not write it
   for a page Nelson has not approved.

4. No git action needed — the watcher scans the working tree. If you do
   commit, commit only files inside `design-refs/redesign-2026-08/`.

## 4 · Order of work

Wave 1, pages 1–10, in the directive's order — except start with
**09-people-search** and **02-new-event** (Nelson's most-flagged pages; a
fast first win matters more than sequence). Do not start Wave 2 until every
Wave 1 page has either an approved artifact or a written note from Nelson
parking it.

## 5 · Rules

- Never submit a prompt to any project other than "Cinch Redesign 2026-08".
- Never invent data fields, prices, quotas, or privacy behavior — the briefs
  carry "Keep" clauses that are law or data truth; if Claude Design's output
  violates one, fix the design, not the constraint.
- If Claude Design produces something that needs a native module (maps, video,
  new system UI), flag it in the folder as `NEEDS-NATIVE.md` — it can still be
  approved, but the watcher must route it to a build instead of an OTA.
- If the browser session logs out, or claude.ai asks to accept new terms,
  stop and hand back to Nelson.
