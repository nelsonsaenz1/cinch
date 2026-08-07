import { useEffect, useState } from 'react';

/**
 * Is the network reachable, right now — the cover's W-11 signal.
 *
 * Neither `@react-native-community/netinfo` nor `expo-network` is installed,
 * and adding a native module for one boolean on one screen means a dev-client
 * rebuild. A polled HEAD against the Supabase project's health endpoint costs
 * nothing measurable and answers the only question the cover asks: "can a
 * sign-in request reach the server?" — which radio-level reachability APIs
 * famously answer wrong (connected to Wi-Fi, no route out).
 *
 * ANY HTTP response counts as online, including a 401 from the missing apikey
 * header — a status code proves the round trip. Only a thrown fetch (no route,
 * DNS failure, timeout) reads as offline. The poll runs only while the hook is
 * mounted, i.e. only on the cover, and auto-restores the buttons when the
 * connection returns, per the atlas note on W-11.
 */
const PING_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/health`;
const PING_INTERVAL_MS = 4000;
const PING_TIMEOUT_MS = 4000;

export function useConnectivity(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let alive = true;

    const ping = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      try {
        await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
        if (alive) setOnline(true);
      } catch {
        if (alive) setOnline(false);
      } finally {
        clearTimeout(timeout);
      }
    };

    void ping();
    const id = setInterval(() => void ping(), PING_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return online;
}
