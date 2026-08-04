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
const config: ExpoConfig = {
  name: 'Cinch',
  slug: 'cinch',
  scheme: 'cinch',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  // No `newArchEnabled` flag: the New Architecture is always on from SDK 55
  // onward and the field was removed from ExpoConfig entirely. There is no
  // opt-out, so every native dependency must be Fabric/TurboModule compatible.

  ios: {
    bundleIdentifier: 'com.nelsonsaenz.cinch',
    supportsTablet: false,
    // Required for expo-apple-authentication; Sign in with Apple is an
    // App Store requirement once any social login ships.
    usesAppleSignIn: true,
    infoPlist: {
      // Apple Vision subject lifting (VNGenerateForegroundInstanceMaskRequest)
      // is iOS 17+. Below that the cutout path degrades to the server fallback.
      LSMinimumSystemVersion: '17.0',

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
      backgroundColor: '#FAF9F6',
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
      'expo-splash-screen',
      {
        backgroundColor: '#FAF9F6',
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
        cameraPermission: false,
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
      },
    ],
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

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
