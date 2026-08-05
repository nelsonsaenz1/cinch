import { requireOptionalNativeModule } from 'expo-modules-core';

import type { GarmentCutoutNativeModule } from './GarmentCutout.types';

/**
 * The native module, or null.
 *
 * Optional rather than required because this module is iOS-only and native: it
 * is absent on web, absent on Android, and absent in Expo Go. `requireNative`
 * would throw at import time in all three, taking the whole bundle down for a
 * feature that has a designed unsupported state.
 */
export default requireOptionalNativeModule<GarmentCutoutNativeModule>('GarmentCutout');
