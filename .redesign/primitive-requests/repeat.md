# Primitive requests — Unit C, The Repeat

Things the shared, read-only layers (`src/theme/**`, `tailwind.config.js`,
`src/features/closet/outfit-count.ts`, `src/lib/styling/**`) don't currently
provide, what I needed them for, and what I did instead without touching them.

## 1 · The exhausted grid's fill colour has no token

**Need:** P-03's 7×N grid of small filled squares (all-worn state) is drawn in
the atlas at `#D9D2C2` — a darker structural tan than anything in the free-tier
contract's colour reconciliation table (§3). `sand` (`#EAE5DB`), `tray`
(`#F0ECE3`) and `rule-strong` (`rgba(28,26,22,.28)`) are all close in spirit
but none of them is this literal, and the contract is explicit that "every
colour comes from a token, no new hex".

**Which atlas state:** P-03, the 14-cell (or N-cell) grid under "You've now
worn all fourteen."

**What I did instead:** `src/components/today/repeat-exhausted.tsx` fills
worn cells with `theme.sand` — the closest existing structural tan already
spent on tile grounds elsewhere in the app — and leaves the padding cells
(when `total` isn't a multiple of 7) fully transparent rather than drawing a
second, unstated tone. Noted inline at the call site too.

## 2 · No data source for "of 14 seen" (P-05's middle stat)

**Need:** The atlas's P-05 prints three stats: `WORN 2×`, `OF 14 SEEN 11`,
`$/WEAR $4.10`. The middle one is an *impressions* count — how many of the
closet's 14 possible outfits have ever been shown/suggested to the user — not
a wear count. Nothing in this app persists what was merely suggested:
`generateOutfits` runs synchronously on-device and its output is never
written anywhere, so there is no honest way to compute "seen" without
inventing a new tracking table, which is squarely `src/lib/styling/**` /
schema territory and out of scope for this unit.

**Which atlas state:** P-05, opened from the notification.

**What I did instead:** Relabelled the middle stat to **"Of {total} worn"**,
computed from `exhaustionProgress(...).wornCount` — the same honestly-derived
number P-03 already uses for its own progress. This is the same substitution
the free-tier contract itself makes for The Gap Feed's G-05 ("build the
state; compute the numbers" rather than match an illustrative figure that
has no real backing data). If a "seen" log is ever added at the shared layer,
this is the one call site that would need to learn about it —
`src/app/repeat-outfit.tsx` and `src/app/dev-repeat.tsx`.

## 3 · The atlas's monospace meta-row (temp / worn / last-date) has no home in the shipped Plate

**Need:** Every P-0x mockup carries a small `ui-monospace` chip row under the
outfit — `14° DRY · WORN 1× · LAST TUE 4 AUG`. The shipped `Plate` (Today)
already prints feels-like temperature in its own header colophon
(`Feels 54°F`) and has no equivalent chip row anywhere in its structure.

**Which atlas state:** P-01, P-02, P-03 all carry some form of this row.

**What I did instead:** Folded the load-bearing facts (the worn count and the
real dates) into the `RepeatMark` copy itself — "You wore this on Tuesday.",
"Third time in the last N weeks — ...dates...and today." — rather than adding
a new chip row to `Plate`. This is a deliberate, minimal reading of rule 11
("do not redesign Today, add the mark to it"): a new persistent row is a
structural change to the card's anatomy, and the two numbers it would have
carried are already said in prose. Noted as a remaining delta in the final
report, not an escalation — nothing here was blocked, it was a scope call.
