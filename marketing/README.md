# marketing/ — how to hand me assets

Drop anything in `00-inbox/` and I'll sort, rename and register it. Everything below
is what makes that faster, not a gate.

---

## The one thing that actually matters

**I cannot watch video.** I have `ffmpeg` in my workspace, so if the file is in this
folder I'll pull frames myself and look at those — you don't need to do anything. But
it means: **put video in the folder, don't paste it into chat.** A chat attachment I
can't process; a file at `/Users/nelsonsaenz/cinch/marketing/...` I can.

Same rule for anything over ~20 MB, and for batches. The folder is the pipe.

---

## Formats

| Type | Send | Not |
|---|---|---|
| **Screen recordings** | `.mp4` or `.mov`, H.264, 1080×1920, 60fps | ProRes, HEVC-only |
| **Stills / screenshots** | **PNG** | ⚠️ **HEIC — I can't read it at all** |
| **Photos off your phone** | PNG or JPEG | HEIC. Set iPhone → Camera → Formats → **Most Compatible**, or export first |
| **Silhouettes / logos** | **SVG source *and* a PNG contact sheet** | SVG alone — I can read the paths but can't reliably render them |
| **Design atlases** | `.dc.html` + `renderings/*.png`, as you already do | — |
| **Layouts / decks** | PDF (I read these natively, page by page) | Sketch, Figma-only, PSD |
| **Copy, lists, data** | `.md`, `.csv`, `.txt` | screenshots of text |

Bridge limits per transfer: **50 files, 400 MB each, 500 MB total.** Batch accordingly.

---

## Folder structure

```
cinch/marketing/
  00-inbox/          ← dump here, no naming needed. I sort it.
  01-captures/       master screen recordings — the source for everything
  02-brand/          logo, type, colour, templates
  03-appstore/       screenshots, previews, custom product pages
  04-social/         finished posts, by platform
  05-web/
  06-email/
  07-press/
  ASSET-REGISTER.csv the index — I maintain this
```

⚠️ **Add `marketing/**` to `.gitignore`, except `*.csv` and `*.md`.** Binaries in git
will bloat the repo fast, and none of this needs version control.

---

## Naming

Only for files you're naming deliberately. Inbox drops don't need it.

```
{month}-{surface}-{format}-{slug}-v{n}.{ext}
```

- **month** — `m1` (Sept, photo intake) · `m2` (Oct, voice) · `m3` (Nov, occasion)
- **surface** — `cap` `asc` `tt` `ig` `pin` `x` `yt` `web` `mail` `press`
- **format** — `comp` (comparison) · `math` · `cpw` (cost-per-wear) · `num` · `magnet` · `demo`
- **slug** — plain English, hyphenated

```
cap-reveal-v1.mov
m1-tt-comp-whering-switch-v1.mp4
m1-pin-math-ten-pieces-v2.png
m2-asc-6.9-03-reveal-v1.png
```

This isn't bureaucracy — with ~400 assets across three months, the filename *is* the
database. It's how I answer "which format is actually producing installs" in week eight
without opening 400 files.

---

## Master captures — the one session that matters

Nine clips, one sitting, real closet and real data. Everything else is cut from these,
so it's worth getting right once.

- Clean status bar — full signal, full battery
- Do not rush the taps. I can speed footage up; I can't slow down a blur.
- Hold two seconds at the end of each beat so there's a clean cut point
- **No placeholder garments, no lorem, no test accounts.** Fake data reads as fake and
  it's the fastest way to lose a viewer.
- Portrait only. One take per clip is fine; a second take is better.

If a clip is wrong I'll tell you exactly which second and why, rather than asking for
the whole session again.

---

## The one piece of metadata I can't infer

For anything involving a creator or paid rights, drop a line in `00-inbox/` as a `.txt`
or just tell me in chat:

- creator handle and platform
- what was paid
- **what rights were granted, and when they expire**
- whether paid usage / whitelisting is included

Everything else about an asset I can work out by looking at it. Rights I cannot, and
publishing something whose rights have lapsed is the one mistake here that costs real
money.

---

## What I do with it

Within a day of anything landing: it's renamed, registered, and either scheduled or
sent back with a specific note. If something's unusable — wrong format, blurred, HEIC —
you'll hear which file and why, not a general complaint.

---

## Product design atlases — different pipeline

The WK / PR / OC atlases and the silhouette library from
`docs/design/reframe-directive.md` §5 go to **Claude Code, not to me**, in the
convention already in the repo: `docs/design/<name>-atlas/` with `renderings/`
alongside.

Send me a copy in `00-inbox/` too if you want a read on whether a state supports the
message before anyone builds it. Cheaper to catch there than in code.
