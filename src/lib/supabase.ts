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

// ---------------------------------------------------------------------------
// Session storage
// ---------------------------------------------------------------------------

/**
 * The auth client only ever needs these three operations, so this is the whole
 * contract the adapter below has to satisfy. Declaring it structurally rather
 * than importing Supabase's `SupportedStorage` keeps the encryption layer
 * testable without dragging the auth client into it.
 */
type SessionStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/**
 * Somewhere small and hardware-backed to keep one 32-byte key.
 *
 * This exists as its own interface because the key and the ciphertext have to
 * live in *different* stores: iOS Keychain protects the key, but SecureStore
 * rejects values over 2048 bytes and a Supabase session (access JWT + refresh
 * token + user object) routinely exceeds that.
 */
type SecretStore = {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
};

/**
 * Authenticated encryption. AES-256-GCM specifically: the session blob must be
 * tamper-evident, not merely unreadable — an attacker who can rewrite a CBC/CTR
 * ciphertext on disk can flip bits in a JWT the client then trusts.
 *
 * Keys and IVs cross this boundary as hex so that no base64 polyfill is
 * required on React Native.
 */
type SessionCipher = {
  randomKeyHex(): string;
  encrypt(plaintext: string, keyHex: string): string;
  decrypt(envelope: string, keyHex: string): string;
};

/** Marks a value as ours and versioned, so a legacy plaintext blob is unmistakable. */
const ENVELOPE_PREFIX = 'cinch.aesgcm.v1.';

/** Keychain item name for the data key. Changing it orphans every stored session. */
const DATA_KEY_NAME = 'cinch.session-data-key.v1';

/**
 * Optional native dependencies.
 *
 * These are resolved through try/catch `require` on purpose: Metro treats a
 * require inside a try block as an optional dependency and will not fail the
 * bundle when the package is absent. Neither package is in package.json yet, so
 * today both resolve to null and sessions stay in plaintext exactly as before —
 * see the warning in `resolveEncryptionBackend`. Adding the two packages is all
 * that is needed to switch encryption on; no further code change.
 */
type SecureStoreModule = {
  getItemAsync(key: string, options?: object): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: object): Promise<void>;
  WHEN_UNLOCKED_THIS_DEVICE_ONLY?: unknown;
};

type QuickCryptoModule = {
  randomBytes(size: number): { toString(encoding: string): string };
  createCipheriv(
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ): {
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(outputEncoding: string): string;
    getAuthTag(): { toString(encoding: string): string };
  };
  createDecipheriv(
    algorithm: string,
    key: Uint8Array,
    iv: Uint8Array,
  ): {
    setAuthTag(tag: Uint8Array): void;
    update(data: string, inputEncoding: string, outputEncoding: string): string;
    final(outputEncoding: string): string;
  };
};

let secureStoreModule: SecureStoreModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  secureStoreModule = require('expo-secure-store') as SecureStoreModule;
} catch {
  secureStoreModule = null;
}

let quickCryptoModule: QuickCryptoModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-quick-crypto') as { default?: QuickCryptoModule };
  quickCryptoModule = (mod.default ?? (mod as unknown as QuickCryptoModule)) ?? null;
} catch {
  quickCryptoModule = null;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function makeSecretStore(mod: SecureStoreModule): SecretStore {
  // WHEN_UNLOCKED_THIS_DEVICE_ONLY keeps the key out of iCloud Keychain and
  // out of encrypted device backups, which is the whole point of moving it off
  // AsyncStorage — a restored backup on another device must not carry a live
  // session with it.
  const options = mod.WHEN_UNLOCKED_THIS_DEVICE_ONLY
    ? { keychainAccessible: mod.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
    : undefined;

  return {
    get: (name) => mod.getItemAsync(name, options),
    set: (name, value) => mod.setItemAsync(name, value, options),
  };
}

function makeCipher(crypto: QuickCryptoModule): SessionCipher {
  return {
    randomKeyHex: () => crypto.randomBytes(32).toString('hex'),

    encrypt(plaintext, keyHex) {
      // A fresh 96-bit IV per write. GCM's security collapses entirely if an IV
      // is ever reused under the same key, and the session blob is rewritten on
      // every token refresh, so this must not be derived or cached.
      const ivHex = crypto.randomBytes(12).toString('hex');
      const c = crypto.createCipheriv('aes-256-gcm', hexToBytes(keyHex), hexToBytes(ivHex));
      // GCM is a stream mode, so each chunk is encoded independently and
      // decoded back in the same order — concatenating two base64 strings would
      // not survive a chunk that is not a multiple of three bytes.
      const chunks = [c.update(plaintext, 'utf8', 'base64'), c.final('base64')];
      const payload = { iv: ivHex, tag: c.getAuthTag().toString('hex'), ct: chunks };
      return ENVELOPE_PREFIX + JSON.stringify(payload);
    },

    decrypt(envelope, keyHex) {
      const payload = JSON.parse(envelope.slice(ENVELOPE_PREFIX.length)) as {
        iv: string;
        tag: string;
        ct: string[];
      };
      const d = crypto.createDecipheriv(
        'aes-256-gcm',
        hexToBytes(keyHex),
        hexToBytes(payload.iv),
      );
      d.setAuthTag(hexToBytes(payload.tag));
      // `final` throws when the tag does not verify — that throw is the
      // integrity check, and callers must not swallow it into a silent success.
      return payload.ct.map((chunk) => d.update(chunk, 'base64', 'utf8')).join('') + d.final('utf8');
    },
  };
}

/**
 * Wrap a plain key-value store so everything written through it is encrypted
 * with a key held in the platform keychain.
 */
export function createEncryptedStorage(deps: {
  inner: SessionStorage;
  secrets: SecretStore;
  cipher: SessionCipher;
}): SessionStorage {
  const { inner, secrets, cipher } = deps;

  // Memoised as a promise, not a value: `getItem` and `setItem` can both be in
  // flight during hydration, and two concurrent misses would otherwise generate
  // two keys and leave the first-written session undecryptable.
  let keyPromise: Promise<string> | null = null;
  const dataKey = () => {
    keyPromise ??= (async () => {
      const existing = await secrets.get(DATA_KEY_NAME);
      if (existing) return existing;
      const fresh = cipher.randomKeyHex();
      await secrets.set(DATA_KEY_NAME, fresh);
      return fresh;
    })();
    return keyPromise;
  };

  return {
    async getItem(key) {
      const raw = await inner.getItem(key);
      if (raw === null) return null;

      if (!raw.startsWith(ENVELOPE_PREFIX)) {
        // A session written by a build that predates this adapter. Signing the
        // user out to gain encryption would be a worse trade than a one-time
        // rewrite, so re-encrypt in place and hand back the value.
        try {
          await inner.setItem(key, cipher.encrypt(raw, await dataKey()));
        } catch {
          // Migration is best-effort; the next write encrypts it anyway.
        }
        return raw;
      }

      try {
        return cipher.decrypt(raw, await dataKey());
      } catch {
        // Wrong key (keychain cleared by a reinstall) or a tampered blob. Both
        // mean there is no trustworthy session — report absence and let the
        // user sign in again rather than feeding unauthenticated bytes to the
        // auth client.
        await inner.removeItem(key);
        return null;
      }
    },

    async setItem(key, value) {
      await inner.setItem(key, cipher.encrypt(value, await dataKey()));
    },

    removeItem: (key) => inner.removeItem(key),
  };
}

function resolveSessionStorage(): SessionStorage {
  if (secureStoreModule && quickCryptoModule) {
    return createEncryptedStorage({
      inner: AsyncStorage,
      secrets: makeSecretStore(secureStoreModule),
      cipher: makeCipher(quickCryptoModule),
    });
  }

  // Deliberately loud rather than silent. This is the pre-existing behaviour
  // (CIN-17), not a new regression, but a security control that fails open must
  // say so — the missing packages are `expo-secure-store` and
  // `react-native-quick-crypto`.
  console.warn(
    '[cinch] Auth session is stored UNENCRYPTED. Install expo-secure-store and react-native-quick-crypto to enable at-rest encryption.',
  );
  return AsyncStorage;
}

export const supabase = createClient<Database>(url, publishableKey, {
  auth: {
    // Session bytes at rest. Encrypted when the optional crypto packages are
    // present, plain AsyncStorage otherwise — see `resolveSessionStorage`.
    storage: resolveSessionStorage(),
    autoRefreshToken: true,
    persistSession: true,
    // PKCE, not the implicit flow. The verifier is generated on this device at
    // `signInWithOtp` time and never leaves it, so a sign-in link crafted
    // elsewhere cannot be redeemed here — that binding is what stops an
    // attacker's link from silently signing a victim into the attacker's
    // account (CIN-03). It also moves the callback token out of the URL
    // fragment and into a one-time `?code=`.
    flowType: 'pkce',
    // Mandatory on native. Left on, the client tries to parse a session out of
    // a URL that never exists and session detection misfires. The callback is
    // parsed by hand in `features/auth/actions.ts` instead.
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
