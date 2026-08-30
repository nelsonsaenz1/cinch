-- ===========================================================================
-- `profiles.reveal_seen_at` — whether this account has ever seen the Reveal.
--
-- The `toured_at` pattern exactly, for the same reason: "once, ever, on any
-- device" is a claim about an account, and AsyncStorage would replay the
-- offer on the iPad and after every reinstall.
--
-- Why it exists at all: the Reveal — the product's proof moment, and the
-- `reveal_complete` paywall placement behind it — was reachable ONLY from
-- The Ten's finish button and the walkthrough's exit. An account that filled
-- its closet any other way (import, add-clothes, the capture flow from
-- Today) never saw it, and nothing recorded that it hadn't. Verified
-- 2026-08-30 against production analytics: zero reveal_phase events from any
-- account after 08-21, including a same-day account with 51 tagged pieces
-- and consent granted. Today's reveal door renders for accounts where this
-- is null and the closet can already generate; the Reveal stamps it on
-- arrival.
--
-- Pre-08-21 accounts that genuinely saw the Reveal have no mark and will be
-- offered the door once. That is accepted, not overlooked: the door shows
-- their real current count, tapping it is harmless, and inventing a
-- backfill from analytics would write server state from a vendor's data.
--
-- No new grants and no new policies: `profiles` carries owner-only RLS and
-- authenticated column access at the table level, and this column inherits
-- both — the lifestyle columns' arrangement (20260825000000).
-- ===========================================================================

alter table public.profiles
  add column if not exists reveal_seen_at timestamptz;
