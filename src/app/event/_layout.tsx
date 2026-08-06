import { Stack } from 'expo-router';

/**
 * The occasion group. Everything under /event/ shares this stack: create,
 * detail, invite — and the outfit-board routes ([id]/outfits, [id]/post,
 * [id]/comments) owned by the event-outfits slice, which register here by
 * file convention without this layout naming them. That is deliberate: the
 * two features couple through route paths, never through imports.
 *
 * Invite is the one presentation override — a sheet over the detail screen,
 * matching the stylist sheet's detents and radius so the app has exactly one
 * idea of what a half sheet is.
 */
export default function EventLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="[id]/invite"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 38,
        }}
      />
    </Stack>
  );
}
