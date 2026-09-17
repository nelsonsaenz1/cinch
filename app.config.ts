import type { ExpoConfig } from 'expo/config';

/**
 * Cinch — AI Stylist & Closet
 *
 * Every iOS usage-description string below is hand-written and names a concrete
 * use. Do not replace them with Expo's generated defaults ("Allow $(PRODUCT_NAME)
 * to access your camera") — since ~2026-07-20 Apple runs an automated Info.plist
 * pass that auto-rejects under Guideline 5.1.1 for generic or placeholder strings,
 * and the rejection names no key, no resource, and no file.
 *
 * Equally important: keys we declare even when the system picker itself does
 * not show a broad-library permission prompt.
 *  - NSPhotoLibraryUsageDescription is required by Apple's static binary scan
 *    because expo-image-picker links photo-library APIs. The app uses the
 *    system picker and receives only the photos the user selects, but the
 *    purpose string must still be present in the submitted binary.
 *  - NSMicrophoneUsageDescription is suppressed UNLESS `CINCH_VOICE_INTAKE=1`.
 *    A wardrobe app that cannot record has no business declaring microphone
 *    access, and an unused permission string is the rejection risk this whole
 *    list is about. Voice intake will earn the key; until its screens exist it
 *    has not. See VOICE_INTAKE below.
 *  - NSLocationAlwaysAndWhenInUseUsageDescription must never appear, and `location`
 *    must never enter UIBackgroundModes. Both invite a justification we cannot meet.
 */
/**
 * Free-team signing.
 *
 * A free Apple personal team may not sign the Sign in with Apple capability,
 * so a build meant for one has to drop it (scripts/free-signing.sh strips the
 * entitlement from the generated project). This flag keeps the JS in step: the
 * welcome screen hides the Apple button when the build cannot honour it, so a
 * demo build offers the email link only instead of a button that throws.
 *
 * Defaults to the full, paid-account behaviour — set CINCH_FREE_SIGNING=1 only
 * for a local personal-team build.
 */
const FREE_SIGNING = process.env.CINCH_FREE_SIGNING === '1';

/**
 * NSMotionUsageDescription — and why it lives in a constant.
 *
 * expo-location's config plugin owns this key. It goes through
 * `IOSConfig.Permissions.createPermissionsPlugin`, whose contract is:
 *
 *   if (permissions[key] === false) delete infoPlist[key];
 *   else infoPlist[key] = permissions[key] || infoPlist[key] || default;
 *
 * The delete is unconditional and the plugin mod runs AFTER the base mod that
 * merges `ios.infoPlist`. So `motionUsagePermission: false` did not merely
 * "decline to add" the key — it deleted the one we had declared in
 * `ios.infoPlist`, silently, on the build server. `expo config` shows the
 * pre-plugin config and so reported the key present; the generated
 * ios/Cinch/Info.plist did not have it. That is how builds 3 and 4 both
 * shipped without it and both drew ITMS-90683.
 *
 * The key is genuinely required: CoreMotion is linked into the app binary via
 * ExpoCamera and ExpoLocation, and Apple's static pass demands a purpose
 * string for it. So the fix is to give the plugin the real string rather than
 * `false`. It is declared in both places from this one constant: the plugin
 * value is what actually lands, and the `ios.infoPlist` copy keeps the key
 * visible where every other purpose string is documented.
 */
const MOTION_USAGE_DESCRIPTION =
  'Cinch reads device orientation while you photograph clothes so each picture comes out the right way up. Nothing about your movement is recorded.';

/**
 * NSPhotoLibraryUsageDescription.
 *
 * `launchImageLibraryAsync` uses Apple's system picker and does not request
 * unrestricted library access. Apple nevertheless requires this key whenever
 * a submitted binary links APIs that can access the photo library
 * (ITMS-90683). Keep the same sentence in `ios.infoPlist` and the
 * expo-image-picker plugin so the last config mod cannot remove or replace it.
 */
const PHOTO_LIBRARY_USAGE_DESCRIPTION =
  'Cinch uses photos you choose from your library to add clothes to your closet and set your profile picture.';

/**
 * Voice intake's native surface — OFF unless explicitly asked for.
 *
 * THE COUPLING THIS FLAG EXISTS TO ENFORCE. Three things must be true together
 * or none of them may be true: the microphone usage string, the `Audio Data`
 * entry in the privacy manifest, and a screen the user can actually reach that
 * records. Today the third is missing — WK-01…WK-06 do not exist because their
 * atlas does not — so a build carrying the first two declares a capability it
 * cannot perform. That is the same class of mismatch as omitting a declaration
 * for something the app DOES do, and Apple cross-checks the manifest against
 * the App Store Connect answers either way.
 *
 * So the three move as one, behind this flag. `expo-audio` stays installed and
 * autolinked — a linked module with no usage string and no importer cannot ask
 * for anything — and Wave 1's build sets `CINCH_VOICE_INTAKE=1` to switch the
 * declarations back on in one place rather than three.
 *
 * Not a build profile in eas.json, deliberately: the declarations have to be
 * consistent between a local `expo prebuild` and the build server, and an
 * env var is the only thing both read.
 */
const VOICE_INTAKE = process.env.CINCH_VOICE_INTAKE === '1';

/**
 * NSMicrophoneUsageDescription — a constant for exactly the MOTION reason above.
 *
 * expo-audio's config plugin owns this key and goes through the same
 * `createPermissionsPlugin` contract, so declaring it in `ios.infoPlist` alone
 * would leave it at the plugin's mercy — which is how builds 3 and 4 shipped
 * without NSMotionUsageDescription. It is set in BOTH places, from here, so
 * whichever mod runs last writes the same sentence.
 *
 * Written in the app's voice rather than boilerplate: this string is read at
 * the moment of the ask, and "Cinch would like to access the microphone"
 * answers none of the question the reader is actually asking, which is why.
 */
const MIC_USAGE_DESCRIPTION =
  'So you can describe your closet out loud instead of photographing it.';

/**
 * NSSpeechRecognitionUsageDescription — new with the on-device recogniser.
 *
 * Required by `SFSpeechRecognizer.requestAuthorization`, and the app crashes on
 * the call without it rather than merely being refused. Declared here alongside
 * the microphone string and gated by the SAME flag: speech recognition without
 * a microphone declaration is a permission for a capability the build does not
 * have, and the two have to move together.
 *
 * The sentence names where the words are turned into text, because that is the
 * question somebody reading this prompt is actually asking. It is true: the
 * native module sets `requiresOnDeviceRecognition`, so this permission covers
 * only the on-device path — the server path is a separate, explicit offer with
 * its own consent.
 */
const SPEECH_USAGE_DESCRIPTION =
  'So your phone can turn a short spoken search into words without sending your voice anywhere.';

const config: ExpoConfig = {
  name: 'Cinch',
  slug: 'cinch',
  scheme: 'cinch',
  // 1.1 is the first UPDATE. 1.0 is approved and live on the App Store, which
  // is why build 39 could not be submitted under 1.0.0 at all — Apple rejects a
  // second submission of a released CFBundleShortVersionString
  // (SUBMISSION_SERVICE_IOS_OLD_APP_VERSION). 1.0 stays live and unaffected
  // while this is in review.
  //
  // This line is a fingerprint input, so bumping it moves the runtime version
  // and the resulting binary is NOT reachable by the updates already published
  // to the production channel at d9cb8c3b…. A fresh OTA has to be published
  // against the new runtime after the build, or 1.1 ships with only its
  // embedded bundle.
  // 1.2.2 embeds the 2026-08-31 OTA batch natively, because a NEW install
  // runs the embedded bundle for its whole first session and only picks up an
  // OTA on relaunch — and first sessions are exactly where the Apple sign-in
  // fix and the reveal door earn their keep. Founder order 2026-08-31, ahead
  // of the featuring window.
  // 1.2.5 (build 49, 2026-09-13, ledger A79) embeds A68 / A28 / A76 / 12.9 and
  // audit ship 11 natively: 10 of 21 real first sessions in the 48 h before the
  // cut ran build 48's embedded bundle and met the pre-A68 ask order.
  version: '1.2.6',
  orientation: 'portrait',
  // Light only. Cinch is a print lookbook, and a print object has one
  // appearance — this pins the app to light regardless of the system setting,
  // which is also what makes the retired `dark:` classes provably inert.
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  // No `newArchEnabled` flag: the New Architecture is always on from SDK 55
  // onward and the field was removed from ExpoConfig entirely. There is no
  // opt-out, so every native dependency must be Fabric/TurboModule compatible.

  ios: {
    bundleIdentifier: 'com.nelsonsaenz.cinch',
    supportsTablet: false,
    // Required for expo-apple-authentication; Sign in with Apple is an
    // App Store requirement once any social login ships.
    usesAppleSignIn: !FREE_SIGNING,

    /**
     * Universal links, for the personal invite at cinchstyle.com/i/@handle.
     *
     * THIS IS AN ENTITLEMENT, which is why it cannot ride an over-the-air
     * update: entitlements live in the provisioning profile, not the bundle.
     * The binary in the field will keep sending every invite tap to the web
     * page until a build carrying this reaches the store.
     *
     * Expect the same failure the push wave hit. Adding `expo-notifications`
     * wrote the `aps-environment` entitlement and fastlane rejected the build
     * with "provisioning profile doesn't include the Push Notifications
     * capability", because EAS only syncs capabilities to the App ID when it
     * has a live Apple session and a build using the stored profile never
     * opens one. `associatedDomains` is the same class of change. The fix is
     * the founder running `eas credentials` and logging in, which regenerates
     * the profile — and it is a once-per-capability tax, not a recurring one.
     *
     * DO NOT try to automate that login. Three attempts with `expect` last
     * wave each mangled the pre-filled Apple ID field (it holds real text, not
     * a placeholder, and Ctrl-U does not clear it) and one corrupted the
     * stored credential file, which had to be repaired by hand.
     *
     * Scoped to the host, not to a path: the AASA file at
     * web/.well-known/apple-app-site-association is what narrows this to `/i/*`
     * so that /privacy, /terms and /support keep opening in the browser. Both
     * halves are required — the entitlement claims the domain, the AASA says
     * which paths of it the app wants.
     */
    /**
     * Invite links are minted only on the apex host, whose AASA endpoint is a
     * direct 200 response. `www` intentionally redirects to the apex, so it is
     * not claimed here: Apple does not follow redirects while fetching AASA.
     */
    associatedDomains: ['applinks:cinchstyle.com'],
    infoPlist: {
      // NOTE: `LSMinimumSystemVersion` used to sit here, intending to require
      // iOS 17. It is a macOS key and iOS ignores it entirely — the real
      // minimum comes from IPHONEOS_DEPLOYMENT_TARGET, which was still 16.4.
      // It is now set for real via expo-build-properties below.

      // The app only ever uses HTTPS, which is exempt standard encryption.
      // Declaring it here stops App Store Connect asking the export-compliance
      // question on every single upload — and, more usefully, stops a build
      // sitting in "Missing Compliance" instead of reaching TestFlight.
      ITSAppUsesNonExemptEncryption: false,

      // iOS caps a third-party app's CUSTOM animations (Reanimated springs,
      // scroll-linked work, the UX-07 press compression) at 60fps on 120Hz Pro
      // devices unless the app opts in — Core Animation requires this key.
      // Native-driven motion already runs at 120. Cost is battery only while
      // animations actually run. Staged in docs/ops/promotion-build-41.md
      // until this build was cut, because this file's blob id is a
      // fingerprint-gate input.
      CADisableMinimumFrameDurationOnPhone: true,

      // iOS 27 SDK turned the long-standing "no UIScene lifecycle" runtime
      // warning into a hard crash on launch
      // (`UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`).
      // Expo SDK 57's generated AppDelegate predates that requirement, so we
      // declare a minimal manifest that opts out of a custom scene class and
      // lets iOS provide its default UIWindowScene. Remove this once Expo
      // SDK ships proper UIScene adoption.
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {},
      },

      // Required by ITMS-90683 (Apple's automated Info.plist pass): expo-camera
      // references CoreMotion — it reads device orientation so a photo taken
      // sideways is stored the right way up. That is the entire use; nothing
      // records or transmits movement.
      //
      // Declaring it HERE is not sufficient on its own — expo-location's plugin
      // owns the key and runs later. See MOTION_USAGE_DESCRIPTION above and the
      // `motionUsagePermission` entry in the expo-location plugin block.
      NSMotionUsageDescription: MOTION_USAGE_DESCRIPTION,

      // Required by ITMS-90683 because expo-image-picker links photo-library
      // APIs. The system picker still shares only the photos the user chooses.
      NSPhotoLibraryUsageDescription: PHOTO_LIBRARY_USAGE_DESCRIPTION,

      // Voice intake, and only when it can actually record — see VOICE_INTAKE.
      // Declaring it HERE is not sufficient on its own either: expo-audio's
      // plugin owns the key and runs later, so the same string is passed to the
      // plugin block below.
      ...(VOICE_INTAKE
        ? {
            NSMicrophoneUsageDescription: MIC_USAGE_DESCRIPTION,
            NSSpeechRecognitionUsageDescription: SPEECH_USAGE_DESCRIPTION,
          }
        : {}),
    },

    /**
     * Privacy manifest.
     *
     * Expo generates one automatically, but its `NSPrivacyCollectedDataTypes`
     * is an empty array — correct for a blank template, wrong for an app that
     * uploads photographs of your clothes, reads your calendar, and sends both
     * to a third-party model. Apple cross-checks this file against the privacy
     * questionnaire in App Store Connect, and a mismatch is a review hold.
     *
     * Every entry below must also be answered the same way in App Store
     * Connect. Nothing here is tracking: no data leaves for advertising, no
     * identifiers are shared with data brokers, so NSPrivacyTracking is false
     * and there are no tracking domains.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyAccessedAPITypes: [
        // Reason codes are Apple's, not free text. CA92.1 = access to
        // UserDefaults by the app itself; 35F9.1 = boot time for in-app
        // measurement; C617.1 = file timestamps for files the app created.
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
          NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
          NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
          NSPrivacyAccessedAPITypeReasons: ['C617.1'],
        },
        {
          NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
          NSPrivacyAccessedAPITypeReasons: ['E174.1'],
        },
      ],
      NSPrivacyCollectedDataTypes: [
        {
          // The garment photographs. This is the app.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePhotosorVideos',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeProductPersonalization',
          ],
        },
        // Voice intake. The recording is uploaded, transcribed by a third-party
        // model and deleted on success — but "collected" is about whether it
        // leaves the device, not how long it is kept, so this is Yes and linked.
        //
        // Present only when the app can actually record (VOICE_INTAKE).
        // Declaring a data type the app does not collect is the same class of
        // mismatch as failing to declare one it does, and this file's own
        // header says a mismatch is a review hold.
        //
        // App Functionality only: unlike the photographs, a recording is never
        // used to personalise anything. It is transcribed and destroyed.
        ...(VOICE_INTAKE
          ? [
              {
                NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeAudioData',
                NSPrivacyCollectedDataTypeLinked: true,
                NSPrivacyCollectedDataTypeTracking: false,
                NSPrivacyCollectedDataTypePurposes: [
                  'NSPrivacyCollectedDataTypePurposeAppFunctionality',
                ],
              },
            ]
          : []),
        {
          // Free-text plans and calendar event titles, both of which reach the
          // styling model. Easy to overlook precisely because it is not a
          // field the user thinks of as "content".
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeOtherUserContent',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeProductPersonalization',
          ],
        },
        {
          // Rounded to ~1.1 km before it leaves the device — see weather.ts.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeCoarseLocation',
          NSPrivacyCollectedDataTypeLinked: false,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeEmailAddress',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Supplied by Sign in with Apple on first authorization only.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeName',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Also the PostHog distinct id: analytics events are keyed to the
          // Supabase user id, which makes this an Analytics purpose too.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
        {
          // The membership plan, written by the Superwall webhook against the
          // signed-in user. Apple cross-checks this manifest against the App
          // Privacy answers in App Store Connect, and a mismatch is a review
          // hold — so anything declared there is declared here.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypePurchaseHistory',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
          ],
        },
        {
          // Screen views and product events (PostHog), identified as above.
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeProductInteraction',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAnalytics',
          ],
        },
      ],
    },
  },

  android: {
    package: 'com.nelsonsaenz.cinch',
    predictiveBackGestureEnabled: false,
    adaptiveIcon: {
      backgroundColor: '#FBFAF6',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },

  plugins: [
    'expo-router',
    'expo-apple-authentication',
    'expo-sqlite',
    [
      'expo-build-properties',
      {
        ios: {
          /**
           * The oldest iOS that can install Cinch — NOT a statement about how
           * current the app is. The app compiles against the iOS 26 SDK and
           * runs on everything above this floor; raising the floor would only
           * remove customers.
           *
           * 17.0 because Apple Vision subject lifting
           * (VNGenerateForegroundInstanceMaskRequest), which powers garment
           * background removal, does not exist below it. That is the one
           * feature with a hard OS requirement, so it sets the number.
           */
          deploymentTarget: '17.0',
        },
      },
    ],
    // `npx expo install --fix` asks for this explicitly. Config plugins only
    // apply what they are listed here — autolinking wires up the native module
    // either way, but the plugin's build-time configuration is skipped unless
    // the package is named. Affects prebuild only; Expo Go is unchanged.
    'expo-image',
    // Same rationale — `npx expo install expo-sharing` asked for this.
    'expo-sharing',
    /**
     * Same rationale again, and this one was a real gap rather than a nicety.
     *
     * Twelve `dev-*` screens import `Asset`/`useAssets` from `expo-asset`
     * directly, but the package was never a dependency of this project — it
     * resolved only because `expo` and `expo-audio` happen to pull it in. That
     * works until either of them stops doing so, at which point a dozen imports
     * break on a lockfile change nobody connected to them. It is a direct
     * dependency now, and named here so its build-time configuration runs.
     */
    'expo-asset',
    /**
     * Push. THE ONE NATIVE CHANGE IN WAVE 5, and the reason atlas 37 cannot
     * ride an OTA: this plugin writes the `aps-environment` entitlement, and an
     * entitlement is part of the signed binary.
     *
     * Listing it here does nothing to the JS bundle. Until a store build is
     * cut, the module is absent at runtime, `PUSH_AVAILABLE` in
     * src/features/push/native.ts is false, and every push surface hides
     * itself — so the same commit is safe to publish over the air and safe to
     * build. See docs/design/diary-boards-activity-contract.md §6.
     *
     * No `sounds`, no custom icon, and deliberately no `mode: 'production'`
     * override: EAS picks the APNs environment from the build profile, and
     * pinning it here is how a TestFlight build ends up unable to receive
     * anything.
     */
    'expo-notifications',
    /**
     * Voice intake's recorder. THE NATIVE CHANGE IN WAVE 1, and the reason The
     * Walkthrough cannot ride an OTA: this is a new native module, so it is
     * absent at runtime until a store build carries it.
     *
     * `microphonePermission` is passed explicitly rather than left to fall
     * through to `ios.infoPlist`. The plugin uses the same
     * `createPermissionsPlugin` contract as expo-location, whose mod runs AFTER
     * the infoPlist merge — relying on the fallback is what put two builds on
     * the store with no NSMotionUsageDescription and two ITMS-90683s in the
     * inbox. One constant, written into both places.
     *
     * Gated on VOICE_INTAKE, with the usage string and the privacy-manifest
     * entry, because listing the module and declaring the permission does NOT
     * give the app a way to record — WK-01…WK-06 do not exist yet. The package
     * stays installed and autolinked either way; without this block the plugin
     * simply never runs, so no key is written and nothing can ask for the
     * microphone.
     */
    ...(VOICE_INTAKE
      ? [
          [
            'expo-audio',
            {
              microphonePermission: MIC_USAGE_DESCRIPTION,
            },
          ] as [string, Record<string, unknown>],
        ]
      : []),
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FBFAF6',
        image: './assets/images/splash-icon.png',
        imageWidth: 76,
      },
    ],
    [
      'expo-image-picker',
      {
        // Apple requires the key for linked photo-library APIs even though the
        // system picker shares only selected photos and does not request broad
        // library access. This plugin is the final writer of the plist key.
        photosPermission: PHOTO_LIBRARY_USAGE_DESCRIPTION,

        // This one MUST be a real string, and the reason is not obvious.
        //
        // Photographing a garment goes through `ImagePicker.launchCameraAsync`
        // (src/features/ingest/use-capture.ts), not expo-camera — so THIS
        // plugin owns NSCameraUsageDescription. Setting it to `false` here
        // deleted the key from the final plist even though expo-camera below
        // declares one and is applied afterwards, which was verified by
        // introspecting the resolved config, not assumed. An iOS app that
        // opens the camera with no usage string is terminated by the system on
        // the spot, so "Take photo" was a guaranteed crash in every build.
        cameraPermission:
          'Cinch uses your camera so you can photograph clothes and add them to your closet.',

        // Genuinely unused: stills only, no video, so no microphone.
        microphonePermission: false,
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          'Cinch uses your camera so you can photograph clothes and add them to your closet.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-location',
      {
        // When-in-use only, and the string says what the location is actually
        // for. "Cinch would like to use your location" is the kind of generic
        // wording the automated 5.1.1 pass rejects.
        locationWhenInUsePermission:
          'Cinch uses your location to get the local forecast, so it can suggest outfits that suit the weather where you are.',
        // Explicitly off. A wardrobe app has no defensible reason to track
        // location in the background, and requesting it invites a
        // justification we could not give.
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,

        // The two "always" keys the header swears must never ship.
        //
        // `isIosBackgroundLocationEnabled: false` does NOT suppress them —
        // it only governs UIBackgroundModes. The permission strings are added
        // unconditionally by expo-location's plugin, and worse, with Expo's
        // own generic defaults ("Allow $(PRODUCT_NAME) to access your
        // location"), which is precisely the wording the automated 5.1.1 pass
        // rejects. `false` is the plugin's documented removal signal, same as
        // the photo-library purpose string above.
        //
        // Verified against the generated ios/Cinch/Info.plist, not assumed:
        // before this, both were present in the built app.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,

        // NOT `false`. This plugin is the last writer of
        // NSMotionUsageDescription, and `false` makes it DELETE the key that
        // `ios.infoPlist` declared — which is exactly what shipped in builds 3
        // and 4 and drew ITMS-90683 twice. CoreMotion is linked into the
        // binary through ExpoCamera and ExpoLocation, so the key has to be
        // there; giving the plugin the real string is the only arrangement
        // that survives prebuild.
        motionUsagePermission: MOTION_USAGE_DESCRIPTION,
      },
    ],
    // Dev-only network keys must not reach the store build. See the plugin.
    './plugins/with-production-privacy-hygiene',
    [
      'expo-calendar',
      {
        calendarPermission:
          'Cinch reads today’s events so it can suggest one outfit that works across everything on your schedule.',
        // Reminders are a separate permission from calendars and nothing here
        // reads them, so the key stays undeclared.
        remindersPermission: false,
      },
    ],
  ],

  // EAS Update (over-the-air JS updates). The URL is this project's update
  // endpoint. Fingerprint policy derives compatibility from the native layer
  // itself, so an update cannot reach a binary built with different native
  // modules even when both binaries carry the same App Store version.
  updates: {
    url: 'https://u.expo.dev/30c4281f-73b9-4bf2-9b4d-e2a62b2552e9',
    checkAutomatically: 'ON_LOAD',
    // Give the native launch check a brief chance to apply an already
    // downloaded update before falling back to the embedded bundle. The app
    // still opens after 1.5 seconds when the network is unavailable.
    fallbackToCacheTimeout: 1500,
  },
  runtimeVersion: {
    policy: 'fingerprint',
  },

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    // Read at runtime by the welcome screen. `isAvailableAsync()` only reports
    // whether the OS supports Sign in with Apple, not whether THIS build holds
    // the entitlement — so the build-time answer has to be carried across too.
    appleSignInEnabled: !FREE_SIGNING,
    eas: {
      projectId: '30c4281f-73b9-4bf2-9b4d-e2a62b2552e9',
    },
  },
  owner: 'nelsonsaenz',
};

export default config;
