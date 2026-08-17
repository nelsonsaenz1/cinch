# Marketing inbox — how to hand me Claude Design exports

Drop a batch here and I can pick it up without asking you anything. One folder per batch, dated.

```
marketing/inbox/2026-08-17/
├── manifest.csv          ← the only required file
├── IG/
│   ├── IG-001.png        ← 1080×1350 (4:5 feed) or 1080×1920 (story)
│   └── IG-002.png
└── TT/
    ├── TT-001.png        ← 1080×1920 static
    └── TT-002.mp4        ← 1080×1920 video
```

## Naming

`<PLATFORM>-<NNN>.<ext>` — zero-padded, sequential inside the batch. That's it. The number is the join key to `manifest.csv`; nothing else about the filename matters.

For a multi-slide Instagram carousel, suffix the slide: `IG-004-s1.png`, `IG-004-s2.png`. Same asset ID, one manifest row.

## manifest.csv

One row per asset. Copy this header exactly:

```csv
asset_id,platform,format,concept,shows_app_ui,build_shown,rights,design_page,notes
IG-001,instagram,feed-4x5,the-ten,no,,owned,"Social Studio p12",
TT-001,tiktok,vertical-9x16,the-ten,yes,36,owned,"Social Studio p18",replace screen at 4.2s
```

| Column | What it's for |
|---|---|
| `asset_id` | Matches the filename stem |
| `platform` | `instagram` / `tiktok` |
| `format` | `feed-4x5`, `story-9x16`, `vertical-9x16`, `carousel-4x5` |
| `concept` | Short slug so I can group variants of the same idea |
| `shows_app_ui` | `yes` / `no` — **this is the one that matters most** |
| `build_shown` | Build number if `shows_app_ui` is yes. Blank otherwise |
| `rights` | `owned` / `licensed` / `unknown`. `unknown` gets quarantined |
| `design_page` | Which Claude Design page it came from, so we can regenerate |
| `notes` | Anything I should know — replacement slots, open questions |

**If you skip the manifest**, I can still read the folder, but I'll have to ask you the `shows_app_ui` and `rights` questions one asset at a time, which is slower for both of us.

## Why `shows_app_ui` matters

Any frame showing Cinch's interface is a product claim. Claude Design renders design-source screens, not the shipping build — the Social Studio work carries an explicit annotation saying those are replacement slots pending release-candidate capture.

So: an asset marked `shows_app_ui=yes` with no `build_shown` is a **draft**, not a publishable post. I'll hold it. Assets that are garments, type, and colour only can go through immediately.

## What I do with a batch

1. Register each asset and check it against the claim rules — voice-intake grep, no fixed outfit count, no "AI stylist" lead, no stale commerce claims.
2. Pair each with a platform-native caption, cover, hashtags, and alt text.
3. Slot it into the queue with a scheduled date.
4. Render the posting board so you have image and caption side by side with one-tap copy.
5. Flag anything held, and say exactly why.
