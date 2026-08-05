import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import { describeWeather, fetchWeather, formatTemp } from '@/features/context/weather';

/**
 * Location + weather proof — `cinch://dev-location`.
 *
 * The real Today screen resolves the city and forecast behind the auth gate,
 * which makes "is it actually reading where I am, or silently falling back?"
 * unverifiable signed-out. This runs the same chain — permission, fix, reverse
 * geocode, forecast — and prints each step, so a wrong city is visible rather
 * than inferred. Set a simulated position first:
 *
 *   xcrun simctl location booted set 39.7392,-104.9903
 *
 * Dev-only, like the other dev- routes.
 */
export default function DevLocationScreen() {
  const probe = useQuery({
    queryKey: ['dev-location-probe'],
    staleTime: 0,
    queryFn: async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        return { status: perm.status, canAskAgain: perm.canAskAgain } as const;
      }

      const pos =
        (await Location.getLastKnownPositionAsync()) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      if (!pos) return { status: 'granted', canAskAgain: perm.canAskAgain, pos: null } as const;

      let place: Location.LocationGeocodedAddress | undefined;
      try {
        [place] = await Location.reverseGeocodeAsync(pos.coords);
      } catch {
        // Reverse geocoding is a nicety; the forecast does not depend on it.
      }

      const weather = await fetchWeather(pos.coords.latitude, pos.coords.longitude);

      return {
        status: 'granted',
        canAskAgain: perm.canAskAgain,
        pos: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        label: place?.city ?? place?.subregion ?? place?.region ?? '',
        weather,
      } as const;
    },
  });

  const d = probe.data;

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16">
        <Text variant="display" trim className="pt-2">
          Location
        </Text>
        <View className="my-3">
          <Rule />
        </View>

        {probe.isLoading ? <Text variant="body">Resolving…</Text> : null}
        {probe.isError ? (
          <Text variant="body" className="text-critical">
            Failed: {String(probe.error)}
          </Text>
        ) : null}

        {d ? (
          <View className="gap-4">
            <Row label="Permission" value={d.status} />
            {'pos' in d && d.pos ? (
              <>
                <Row
                  label="Coordinates"
                  value={`${d.pos.latitude.toFixed(4)}, ${d.pos.longitude.toFixed(4)}`}
                />
                <Row label="Reverse geocoded city" value={d.label || '(none)'} />
                {d.weather ? (
                  <>
                    <Row
                      label="Feels like"
                      value={formatTemp(d.weather.feelsLikeC, 'F')}
                    />
                    <Row label="Conditions" value={describeWeather(d.weather, 'F')} />
                  </>
                ) : (
                  <Row label="Forecast" value="(unavailable)" />
                )}
              </>
            ) : (
              <Text variant="body" className="text-muted">
                No position fix. Set one with:{'\n'}xcrun simctl location booted set 39.7392,-104.9903
              </Text>
            )}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text variant="colophon">{label}</Text>
      <Text variant="body" className="mt-0.5">
        {value}
      </Text>
    </View>
  );
}
