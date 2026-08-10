# Primitive requests — Unit V, Activity (atlas 32, AV-01…AV-05)

Two requests against the read-only shared kit. Neither blocked; both are worked
around inside this unit's own territory and recorded so the gap is on the record
rather than silently absent.

## 1 · `Button` needs a size, or the app needs a second, smaller control

**What the atlas draws.** Atlas 32's row anatomy is explicit: *"The answer — up
to two buttons, **34pt**, the affirmative solid."* The dc.html sets them at
`height:34px; border-radius:9px; font-size:13px; padding:0 14px`.

**What the shared `Button` is.** A 44pt floor (`MIN_TAP_TARGET`), a 12pt radius
(`RADIUS`), and a 17px label (`variant="body"`), all fixed inside the animated
ground. There is no prop that reaches any of the three.

**Why it matters here more than elsewhere.** Activity is a *column* of these.
One 44pt ink pill on a page is a hero action; a page of eight of them is a
different screen from the one the atlas drew — the rows grow by a third and the
list stops reading as a ledger.

**What I did instead.** `ActivityButton` in
`src/components/activity/ActivityRow.tsx` — the same local composition
`src/app/(tabs)/explore.tsx` already ships as `LatelyButton` for the Lately
atlas, at the same 34/9/13, with the same `usePressFeedback`, the same haptic,
and the same `hitSlop` restoring the 44pt tap target. It is now the **second**
copy of that control in the app, which is the actual cost of this gap.

**The request.** A `size?: 'default' | 'compact'` on `Button` (34pt / r9 / 13px
label / 14px inset, `hitSlop` making up the difference to 44), so both atlases
can delete their copy. Not a `height` prop — two sizes are a vocabulary, an
arbitrary number is a licence.

## 2 · `Spinner` is oxblood-crowned, and an in-row spinner is not an accent

**What the atlas draws.** AV-05's pending row: a 15pt ring, `border:1.5px
rgba(28,26,22,.2)` with `border-top-color:#1C1A16` — an *ink* ring.

**What the shared `Spinner` is.** `src/components/ui/skeleton.tsx` draws
`borderTopColor: theme.accent`. On this page that spends the one oxblood on a
loading state, and the page's only legitimate accent is the failure — AV-04's
glyph and AV-05's failed-answer line.

**What I did instead.** React Native's own `ActivityIndicator` at
`color={theme.ink}`, which is the atlas's ring and adds no colour.

**The request.** A `tone?: 'accent' | 'ink'` on `Spinner`, so a spinner sitting
inside a row can be quiet without a screen reaching past the kit for it.

---

## Not a primitive request — recorded so it is not rediscovered

`faint` (#8A8578) appears three times in atlas 32: the four row glyphs, the
elapsed label (#A29C90, `byline`, lighter still), and the answered-row outcome
line. All three are rendered in `muted` here, per the standing refusal. The
elapsed label therefore separates from the day heading above it by **size**
(`colophon` 10px vs `eyebrow` 11px) rather than by colour, which is the only
axis left once both are `muted`.
