import { requireOptionalNativeModule } from 'expo-modules-core';

import type {
  GarmentVisionNativeModule,
  LocalSpeechNativeModule,
} from './GarmentVision.types';

/**
 * Optional, for the same reason the cutout is: iOS-only and native, so absent
 * on web, on Android and in Expo Go. A required import would take the whole
 * bundle down for features that have designed unsupported states.
 */
export const GarmentVision =
  requireOptionalNativeModule<GarmentVisionNativeModule>('GarmentVision');

export const LocalSpeech = requireOptionalNativeModule<LocalSpeechNativeModule>('LocalSpeech');
