import { requireOptionalNativeModule } from 'expo-modules-core';

import type { VenueSearchNativeModule } from './VenueSearch.types';

/**
 * Optional, and the optionality is load-bearing.
 *
 * This module is native and apple-only, so it is absent on web, on Android, in
 * Expo Go, and — the case that actually happens — in any JavaScript bundle
 * running on a runtime built before it landed. `null` there is not a
 * degradation to paper over: the Where field has a designed manual-first state
 * for exactly it, and a required import would take the whole bundle down
 * instead.
 */
export const VenueSearch = requireOptionalNativeModule<VenueSearchNativeModule>('VenueSearch');
