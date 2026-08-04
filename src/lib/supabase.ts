import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill it in.',
  );
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    // AsyncStorage, deliberately — NOT expo-secure-store. SecureStore caps
    // values at 2048 bytes and a Supabase session (JWT + refresh token)
    // exceeds that, so it fails at runtime rather than at build time.
    // If at-rest encryption is needed later, the supported pattern is a hybrid:
    // AES key in SecureStore, ciphertext in AsyncStorage.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mandatory on native. Left on, the client tries to parse a session out of
    // a URL that never exists and session detection misfires.
    detectSessionInUrl: false,
  },
});

/**
 * Prefer this over `getUser()` on render paths.
 *
 * `getUser()` round-trips to the auth server on every call, which is wasteful
 * on a screen like the closet grid that re-renders constantly. `getClaims()`
 * validates the JWT locally.
 */
export async function getUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return (data.claims.sub as string) ?? null;
}
