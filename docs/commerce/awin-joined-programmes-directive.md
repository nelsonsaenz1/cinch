# Directive — wire joined Awin programmes into Cinch

**Written 2026-08-25. For the Claude Code session in the Cinch repo.**
Prompted by five inbound Awin advertiser invitations in Nelson's Gmail
(Aug 11–25). Read `docs/commerce/merchant-allowlist.md` and
`docs/commerce/affiliate-application-directive.md` §8 before starting.

---

## 0 · The facts, and one correction

These were **merchant-initiated invitations, not approvals of our
applications** — zero applications have been submitted to date
(`application-ledger.csv`). Merchants mass-invite new publishers; relevance
is not implied. The five, with disposition already decided:

| Advertiser | Awin ID | Catalogue | Disposition |
|---|---|---|---|
| **CICYBELL** | **124976** | Women's workwear, dresses, casual (18% comm.) | **ACCEPT — the only apparel merchant** |
| TideWe | 78182 | Hunting/fishing gear | Decline / ignore |
| Piscifun | 89509 | Fishing rods & reels | Decline / ignore |
| SAILO, INC | 92667 | Boat rentals | Decline / ignore |
| brkox | 129093 | LEGO display frames | Decline / ignore |

Accepting an invitation happens in the Awin dashboard (Nelson or the Cowork
browser agent — not this session). **Your work is everything after acceptance.**
Do not add the four declined merchants to anything.

## 1 · The pipeline this directive exists to build

The condition "first Awin approval" (affiliate directive §8) is about to be
true via CICYBELL. Build the joined-programmes path end to end so this and
every later approval flows in with no further engineering:

1. **Read joined programmes from the API** —
   `GET /publishers/3030871/programmes?relationship=joined` (token in
   Edge Function secrets as `AWIN_API_TOKEN`). Write results into
   `commerce_joined_programmes`. This read is the source of truth; never
   hand-maintain the joined list.
2. **Schedule `sync-feeds`** — `docs/commerce/sync-feeds-dormant.md` states
   the wake condition is the first row in `commerce_joined_programmes`.
   Follow that doc's activation steps; respect its quota math.
3. **Affiliate link construction** — joined programme links must carry
   publisher ID 3030871 and **no click-level identifiers**: no `clickref`,
   `clickref2`–`6`, SubID, publisher reference, under any name
   (`commerce-directive.md` §6 refusal 7). Verify by inspecting a generated
   link in tests, not by reading the builder.
4. **Allowlist gate stays sovereign** — joining a programme does NOT put a
   merchant in the app. `gap-shop-match` names only the 82 in
   `supabase/functions/_shared/merchants.ts`. CICYBELL is not among them.
   If Nelson wants it surfaced: follow the rebuild procedure in
   `merchant-allowlist.md` (it is founder-owned; propose the edit, he
   approves, bump `ALLOWLIST_REVIEWED_ON`). Do not slip it in.
5. **Health visibility** — after the first sync,
   `select jsonb_pretty(commerce_health_report());` must show
   `monetisation.joined_programmes ≥ 1` and the feed counters moving.
   Add a test or check only if one doesn't already exist.

## 2 · Ledger bookkeeping

`application-ledger.csv` gains five rows (network `awin`, tranche `INBOUND`),
statuses: CICYBELL `invited-accept-pending`; the other four
`invited-declined: off-category`. Update CICYBELL to `approved` only after the
API read confirms it. Commit same day.

## 3 · Out of bounds

- Accepting/declining invitations in the Awin UI (browser session's job).
- Adding any merchant to the allowlist without Nelson's explicit approval.
- Rakuten work — separate track, nothing has changed there.
- Emailing merchants back.
