# Paywall 252860 — recovered design spec
Captured 2026-08-06 from the live Superwall editor tab by walking the rendered DOM.
**Why this file exists:** this design was never once saved to Superwall's servers — `save+promote` has failed with `NOT_FOUND` since creation, so `updated_at` never moved off `created_at` and the stored document is unreadable server-side. The design existed only in one open browser tab. This is the recovery artifact: enough to rebuild it exactly.
Raw capture: `cinch-paywall-252860-capture.json` (73 nodes, every computed font, colour, radius, padding and box size).

## Copy, in order

```
10:11
✕
CINCH MEMBERSHIP
A stylist for the clothes you already own.
You've had full access to Cinch. To keep every outfit, your whole closet, and the stylist, choose a plan.
THE DATA BEHIND EVERY OUTFIT
Cost-per-wear
What each garment has really cost you, every time you've worn it.
Colour harmony
The colours in your closet that genuinely work together.
What you actually wear
Real usage, so nothing good sits unworn at the back.
CHOOSE A PLAN
Monthly
Annual
Annual is about two months free.
Standard
$7.99
/ month
✓
150 garments
A fresh outfit every day
30 stylist messages a month
Pro
$14.99
/ month
✓
Unlimited garments
Unlimited outfits
Unlimited stylist
Continue — $7.99 / month
$7.99 billed monthly. Cancel anytime in Settings.
Restore Purchases
Terms
Privacy
Your subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store settings.
Stack

Has Introductory Offer
```

## Structure

Indent = DOM depth. Sizes are the rendered device preview (235pt-wide viewport).

- div 249×523
  bg: `rgb(35, 39, 46)` · radius: `70px` · padding: `12px`
  - div 235×508
    bg: `rgb(255, 255, 255)` · radius: `58px`
      - div 75×21 “10:11”
        font: `normal 600 14.82px/14.82px Rubik` · color: `rgb(0, 0, 0)` · flex: `row jc:center ai:center gap:normal`
    - div 70×21
      bg: `rgb(0, 0, 0)` · radius: `22.815px` · flex: `row jc:flex-end ai:center gap:normal`
      - div 13×13
        bg: `rgba(255, 255, 255, 0.2)` · radius: `9999px`
        - div 235×508
          bg: `rgb(255, 255, 255)`
                - div 235×508
                  bg: `rgb(255, 255, 255)`
                    - div 235×876
                      bg: `rgb(251, 250, 246)` · padding: `56px 20px 44px` · flex: `column jc:start ai:stretch gap:0px`
                      - div 19×19
                        bg: `rgba(28, 26, 22, 0.05)` · radius: `16px`
                        - span 6×8 “✕”
                          font: `normal 300 14px/14px Helvetica Neue` · color: `rgb(107, 102, 92)`
                      - span 211×8 “CINCH MEMBERSHIP”
                        font: `normal 500 11px/12.65px Helvetica Neue` · color: `rgb(138, 133, 120)` · tracking: `1.6px` · transform: `uppercase`
                          - span 144×51 “A stylist for the clothes you”
                            font: `normal 400 38px/40.28px Instrument Serif` · color: `rgb(28, 26, 22)` · tracking: `-0.4px`
                          - span 190×51 “already own.”
                            font: `italic 400 38px/40.28px Instrument Serif` · color: `rgb(28, 26, 22)` · tracking: `-0.4px`
                      - span 211×42 “You've had full access to Cinch. To keep every outfit, your whole clos”
                        font: `normal 400 15.5px/23.25px Helvetica Neue` · color: `rgb(107, 102, 92)`
                        - span 211×15 “THE DATA BEHIND EVERY OUTFIT”
                          font: `normal 500 11px/12.65px Helvetica Neue` · color: `rgb(138, 133, 120)` · tracking: `1.6px` · transform: `uppercase` · padding: `0px 0px 12px`
                          - div 4×4
                            bg: `rgb(176, 138, 118)` · radius: `3px` · flex: `column jc:start ai:stretch gap:0px`
                            - span 200×11 “Cost-per-wear”
                              font: `normal 500 14px/18.2px Helvetica Neue` · color: `rgb(28, 26, 22)`
                            - span 200×24 “What each garment has really cost you, every time you've worn it.”
                              font: `normal 400 13.5px/19.575px Helvetica Neue` · color: `rgb(107, 102, 92)`
                          - div 4×4
                            bg: `rgb(176, 138, 118)` · radius: `3px` · flex: `column jc:start ai:stretch gap:0px`
                            - span 200×11 “Colour harmony”
                              font: `normal 500 14px/18.2px Helvetica Neue` · color: `rgb(28, 26, 22)`
                            - span 200×24 “The colours in your closet that genuinely work together.”
                              font: `normal 400 13.5px/19.575px Helvetica Neue` · color: `rgb(107, 102, 92)`
                          - div 4×4
                            bg: `rgb(176, 138, 118)` · radius: `3px` · flex: `column jc:start ai:stretch gap:0px`
                            - span 193×11 “What you actually wear”
                              font: `normal 500 14px/18.2px Helvetica Neue` · color: `rgb(28, 26, 22)`
                            - span 193×12 “Real usage, so nothing good sits unworn at the back.”
                              font: `normal 400 13.5px/19.575px Helvetica Neue` · color: `rgb(107, 102, 92)`
                        - span 211×8 “CHOOSE A PLAN”
                          font: `normal 500 11px/12.65px Helvetica Neue` · color: `rgb(138, 133, 120)` · tracking: `1.6px` · transform: `uppercase`
                          - div 211×26
                            bg: `rgb(240, 236, 227)` · radius: `12px` · padding: `3px`
                            - div 106×23
                              bg: `rgb(255, 255, 255)` · radius: `9px`
                              - span 30×9 “Monthly”
                                font: `normal 500 13.5px/15.525px Helvetica Neue` · color: `rgb(28, 26, 22)`
                            - div 101×23
                              radius: `9px`
                              - span 26×9 “Annual”
                                font: `normal 500 13.5px/15.525px Helvetica Neue` · color: `rgb(138, 133, 120)`
                          - span 211×8 “Annual is about two months free.”
                            font: `normal 400 12px/13.8px Helvetica Neue` · color: `rgb(138, 133, 120)`
                        - div 211×125
                          bg: `rgb(241, 231, 228)` · radius: `16px` · border: `1px rgb(110, 43, 43)` · padding: `16px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 77×17 “Standard”
                                font: `normal 400 24px/28.8px Instrument Serif` · color: `rgb(28, 26, 22)`
                                - span 47×18 “$7.99”
                                  font: `normal 400 30px/30px Instrument Serif` · color: `rgb(28, 26, 22)`
                                - span 27×8 “/ month”
                                  font: `normal 400 13px/13px Helvetica Neue` · color: `rgb(107, 102, 92)`
                            - div 13×13
                              radius: `11px` · border: `1px rgb(110, 43, 43)`
                              - span 6×7 “✓”
                                font: `normal 400 11px/11px system` · color: `rgb(110, 43, 43)`
                          - div 190×1
                            bg: `rgba(28, 26, 22, 0.12)` · flex: `column jc:start ai:stretch gap:0px`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 50×11 “150 garments”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 83×11 “A fresh outfit every day”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 103×11 “30 stylist messages a month”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                        - div 211×125
                          bg: `rgb(255, 255, 255)` · radius: `16px` · border: `1px rgba(28, 26, 22, 0.12)` · padding: `16px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 88×17 “Pro”
                                font: `normal 400 24px/28.8px Instrument Serif` · color: `rgb(28, 26, 22)`
                                - span 58×18 “$14.99”
                                  font: `normal 400 30px/30px Instrument Serif` · color: `rgb(28, 26, 22)`
                                - span 27×8 “/ month”
                                  font: `normal 400 13px/13px Helvetica Neue` · color: `rgb(107, 102, 92)`
                            - div 13×13
                              radius: `11px` · border: `1px rgba(28, 26, 22, 0.35)`
                              - span 6×7 “✓”
                                font: `normal 400 11px/11px system` · color: `rgba(0, 0, 0, 0)`
                          - div 190×1
                            bg: `rgba(28, 26, 22, 0.12)` · flex: `column jc:start ai:stretch gap:0px`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 71×11 “Unlimited garments”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 59×11 “Unlimited outfits”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                              - div 2×2
                                bg: `rgb(176, 138, 118)` · radius: `2px` · flex: `column jc:start ai:stretch gap:0px`
                              - span 58×11 “Unlimited stylist”
                                font: `normal 400 13.5px/18.9px Helvetica Neue` · color: `rgb(63, 59, 52)`
                      - div 211×32
                        bg: `rgb(110, 43, 43)` · radius: `12px`
                        - span 116×11 “Continue — $7.99 / month”
                          font: `normal 500 16px/18.4px Helvetica Neue` · color: `rgb(255, 255, 255)`
                      - span 211×8 “$7.99 billed monthly. Cancel anytime in Settings.”
                        font: `normal 400 11.5px/13.225px Helvetica Neue` · color: `rgb(138, 133, 120)`
                        - span 66×9 “Restore Purchases”
                          font: `normal 400 13px/14.95px Helvetica Neue` · color: `rgb(107, 102, 92)`
                        - div 2×2
                          bg: `rgb(199, 193, 180)` · radius: `1.5px` · flex: `column jc:start ai:stretch gap:0px`
                        - span 21×9 “Terms”
                          font: `normal 400 13px/14.95px Helvetica Neue` · color: `rgb(107, 102, 92)`
                        - div 2×2
                          bg: `rgb(199, 193, 180)` · radius: `1.5px` · flex: `column jc:start ai:stretch gap:0px`
                        - span 26×9 “Privacy”
                          font: `normal 400 13px/14.95px Helvetica Neue` · color: `rgb(107, 102, 92)`
                      - span 192×30 “Your subscription renews automatically unless cancelled at least 24 ho”
                        font: `normal 400 11px/16.5px Helvetica Neue` · color: `rgb(138, 133, 120)`
                      - div 235×876
                        bg: `rgba(0, 0, 0, 0.02)` · border: `2px rgb(0, 129, 255)`
                          - div 25×11 “Stack”
                            font: `normal 400 12px/16.8px system-ui` · color: `rgb(255, 255, 255)` · bg: `rgb(0, 129, 255)` · radius: `4px` · padding: `0px 5px` · flex: `row jc:normal ai:center gap:normal`
    - div 80×2
      radius: `2px`
- div 127×20
  bg: `rgb(35, 39, 46)` · radius: `8px` · border: `1px rgba(255, 255, 255, 0.1)` · padding: `0px 3px` · flex: `row jc:normal ai:center gap:normal`
    - p 87×12 “Has Introductory Offer”
      font: `normal 400 14px/20px Rubik` · color: `rgb(255, 255, 255)`
    - button 21×13
      bg: `rgba(68, 73, 78, 0.5)` · radius: `9999px` · border: `1px rgba(255, 255, 255, 0.1)` · flex: `row jc:normal ai:center gap:normal`
      - span 10×10
        bg: `rgb(255, 255, 255)` · radius: `9999px`
