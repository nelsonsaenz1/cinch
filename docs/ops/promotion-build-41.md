# ProMotion — staged for store build 41

Add to `app.config.ts` → `ios.infoPlist` when build 41 is cut, and re-take the
fingerprint-gate ids at submission (tests/fingerprint-gate.test.ts says how):

```ts
CADisableMinimumFrameDurationOnPhone: true,
```

Why: iOS caps a third-party app's CUSTOM animations (Reanimated springs,
scroll-linked work, the UX-07 press compression) at 60fps on 120Hz Pro devices
unless the app opts in — Core Animation requires the key. Native-driven motion
(system scroll deceleration, the glass tab bar) already runs at 120. Cost is
battery only while animations actually run.

Why it is NOT in app.config.ts today, even as a comment: the file's git blob id
is itself a fingerprint-gate input (tests/fingerprint-gate.test.ts), so any
byte moved there — comments included — trips the gate that protects the OTA
rail against build 40. This note is the staging area instead.
