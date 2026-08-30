import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spinner } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';

/**
 * The route `cinch://pinterest-callback` lands on — auth-callback's
 * arrangement, one integration over.
 *
 * In the ordinary flow nobody sees this screen: `openAuthSessionAsync`
 * intercepts the redirect inside the auth sheet and hands the URL straight
 * back to `useConnectPinterest`. This file exists for the stray path — the
 * person finished OAuth in a full browser tab, or iOS re-delivered the link —
 * where expo-router would otherwise show its headerless Unmatched screen over
 * a connection that quietly succeeded underneath.
 *
 * The exchange itself happened SERVER-SIDE before this URL was ever issued
 * (the /callback route redirects here only after storing the grant), so there
 * is nothing to complete — only a cache to refresh and a person to put back
 * on the page that shows their new state.
 */
export default function PinterestCallbackScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const params = useLocalSearchParams<{ connected?: string; error?: string }>();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void qc.invalidateQueries({ queryKey: ['pinterest-connection'] });
    // Replace, not push: Back from the connection page must not return here.
    router.replace('/privacy/pinterest');
  }, [params.connected, params.error, qc, router]);

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
      <View className="items-center gap-3">
        <Spinner />
        <Text variant="body" className="text-muted">
          Finishing up with Pinterest…
        </Text>
      </View>
    </SafeAreaView>
  );
}
