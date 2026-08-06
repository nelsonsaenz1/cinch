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
 * Equally important: keys we do NOT declare.
 *  - NSPhotoLibraryUsageDescription is deliberately suppressed. launchImageLibraryAsync
 *    runs out-of-process via PHPickerViewController and needs no photo permission;
 *    declaring an unused key is itself a rejection risk.
 *  - NSMicrophoneUsageDescription is suppressed. A wardrobe app has no business
 *    declaring microphone access.
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

const config: ExpoConfig = {
  name: 'Cinch',
  slug: 'cinch',
  scheme: 'cinch',
  version: '1.0.0',
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
          NSPrivacyCollectedDataType: 'NSPrivacyCollectedDataTypeUserID',
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: [
            'NSPrivacyCollectedDataTypePurposeAppFunctionality',
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
        // `false` suppresses the key entirely. The picker does not need photo
        // permission on iOS 11+ — see the header comment.
        photosPermission: false,

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

        // The three keys above the header swears must never ship.
        //
        // `isIosBackgroundLocationEnabled: false` does NOT suppress them —
        // it only governs UIBackgroundModes. The permission strings are added
        // unconditionally by expo-location's plugin, and worse, with Expo's
        // own generic defaults ("Allow $(PRODUCT_NAME) to access your
        // location"), which is precisely the wording the automated 5.1.1 pass
        // rejects. `false` is the plugin's documented removal signal, same as
        // `photosPermission: false` above.
        //
        // Verified against the generated ios/Cinch/Info.plist, not assumed:
        // before this, all three were present in the built app.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
        motionUsagePermission: false,
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
  // endpoint; `appVersion` policy means an update can only reach binaries
  // whose native version matches the version it was published against —
  // never a binary with different native modules.
  updates: {
    url: 'https://u.expo.dev/30c4281f-73b9-4bf2-9b4d-e2a62b2552e9',
  },
  runtimeVersion: {
    policy: 'appVersion',
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
