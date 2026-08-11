# Capture kit — twelve clips, one afternoon
**Voice ships in 1.0, so the shot list grew from nine to twelve.**

---

## Method: simulator, not a freelancer

**Do not pay someone online for this.** To record your app a freelancer needs a dev
build, an EAS account or TestFlight seat, a seeded demo closet, and your credentials.
That's a lot of access to hand a stranger for a $150 job, every re-shoot is a round trip,
and the moment a caption changes you're paying again.

`xcrun simctl` records the simulator natively, for free, in seconds, as many times as you
want. Native resolution on an iPhone 16 Pro Max simulator is **1320×2868** — exactly the
App Store 6.9" size, no scaling.

### The split

| Clips | Capture on | Why |
|---|---|---|
| **10 of 12** | **Simulator** | Deterministic, re-recordable, free, native resolution |
| **The Ten** (photographing) | **Real device** | The simulator has no camera |
| **App Preview videos** (the 3 you submit to App Store Connect) | **Real device** | Apple's guidance is device capture, and previews get more scrutiny than social clips. Simulator footage is completely fine for TikTok/Reels/Pinterest — it's the store submission where I'd be careful. |

### What Claude Code should build first

Two small scripts. Both are in the launch directive's scope and both pay for themselves
in the first hour.

**`scripts/seed-demo.ts`** — loads a real demo closet into a local account. The garment
photography already exists at `docs/design/closet-atlas/assets/garments/` (cream mohair
sweater, white linen blouse, charcoal tailored trousers, beige corduroy skirt, cognac
shearling coat, brown leather loafers, cognac leather tote). Seven pieces is enough for
some clips; extend to ~23 so the whole-closet reveal has a real number behind it.

⚠️ **The reveal number must be computed, not typed.** `countOutfits()` runs on whatever
you seed. If you seed 23 pieces the number is whatever the engine says — use that in the
copy, don't seed backwards from a number you liked.

**`scripts/capture.sh`** — wraps the recording so every clip comes out identical:

```bash
xcrun simctl status_bar booted override \
  --time "9:41" --cellularBars 4 --batteryState charged --batteryLevel 100
xcrun simctl io booted recordVideo --codec h264 --mask ignored "$1.mov"
```

The status-bar override is what gives you Apple's clean 9:41 / full-bars chrome. Without
it every clip shows a half-empty battery and a stray carrier name, and they can't be
intercut.

### Driving it

You tap through while it records. For twelve clips that's faster than automating it —
an XCUITest target is the right answer if you're re-recording every release, but it's
half a day of setup to save twenty minutes today. Build it later if captures become
routine.

---

## The twelve clips

Record **portrait only**. Two takes each — the second is almost always better and it
costs you thirty seconds. Hold two seconds at the end of every beat so there's a clean
cut point.

### Voice — the new three, and the most important in the set

**1 · The Walkthrough** · 20s · `cap-walkthrough`
Recording in progress. The level meter live and responding, elapsed time climbing.
Speak real garment names into the Mac's mic — *"navy wool crewneck… black ankle boots…
the cognac coat"* — so the meter moves in time with actual words.
**Must show:** the seismograph moving, the timer, and the privacy line if it's on screen.

**2 · The Reading** · 8s · `cap-reading`
The precipitate animation, uncut, start to finish. Transcript sets, spans brighten and
lift, the pile builds and settles.
**Do not speed this up in the capture** — record it real-time and speed it in the edit if
needed. This is the most beautiful eight seconds the product has.

**3 · The Procession** · 15s · `cap-procession`
Five cards confirmed at a natural pace. **The receipt line must be legible in at least
three of the five** — `you said: "my navy wool crewneck"` is the thing that makes the
whole feature feel like a conversation instead of a guess. If it's cropped, reshoot.

### The payoff

**4 · The Reveal** · 6s · `cap-reveal`
The number landing. Hold two full seconds on it after the animation settles — this is
the frame that becomes App Store screenshot 2 and the share card.

### Daily use

**5 · Today** · 8s · `cap-today`
Outfit of the day with the weather line visible. Scroll once to show the second look.

**6 · Closet scroll** · 8s · `cap-closet`
Slow, even scroll through the seeded closet. No flicking — a fast scroll motion-blurs
and is useless as B-roll.

**7 · Cost-per-wear** · 6s · `cap-cpw`
The number on a real garment. If the figure changes on screen, capture the change.

### The occasion

**8 · The occasion, end to end** · 25s · `cap-occasion`
Create → invite → pin two looks → vote → decided. The longest clip and the one that cuts
into the most pieces. Take it slowly; you'll be pulling four separate 5-second cuts out
of this.

**9 · The vote** · 8s · `cap-vote`
Two looks side by side, a vote landing, the comment appearing. This is the share-card
moment and the strongest natural invite in the product.

### Supporting

**10 · Packing** · 10s · `cap-packing`
Destination and duration in, the smallest set out. The subtitle claims "Packing List" —
this clip is what makes that claim visible.

**11 · Borrow request** · 8s · `cap-borrow`
Browse a friend's closet, ask, granted.

**12 · Stylist** · 8s · `cap-stylist`
*"Dinner at 7, drinks after"* typed, answer returned.

### Still needed on a real device

**13 · The Ten** · 20s · `cap-the-ten` · **device only**
Photographing pieces, to be sped 4× in the edit. The simulator has no camera. Lower
priority now that voice leads — but it's the second intake path and the App Store set
should show it exists.

---

## Rules that apply to all twelve

- **Real data only.** No lorem, no placeholder garments, no test account names. Fake data
  reads as fake inside two seconds and it's the fastest way to lose a viewer.
- **Real numbers only.** Every figure on screen — outfit counts, cost-per-wear, item
  totals — must be what the engine actually returned for the seeded closet.
- **Don't rush the taps.** I can speed footage up in the edit. I cannot un-blur it.
- **No notification banners.** Enable Do Not Disturb on the simulator before recording.
- **Same device, same seed, all twelve.** Clips that don't intercut are half as useful.

---

## What happens next

Drop the raw files in `marketing/01-captures/` as `cap-{name}-v1.mov`. I'll pull frames,
check each one against this list, and tell you specifically which second of which clip
needs a retake rather than asking for the session again.

From twelve clips I can produce the App Store set, three App Preview cuts, and the first
forty short-form videos. **This session is the only thing standing between the plan and
the first post.**
