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
  ],

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
