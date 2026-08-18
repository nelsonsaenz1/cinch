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
      {/* The composer is a SHEET now — redesign 02's first sentence, and the
          reason the frames draw a grabber over a dimmed page. Full detent
          only: it is a form with a docked CTA, and a half-height detent would
          put the create button under the keyboard at every type size. The
          30pt corner is the artifact's own, against the 38 the half sheets
          below use — the composer sits closer to the screen edge because it
          fills it. Draft preservation is unaffected: the swipe-down dismiss
          raises the same `beforeRemove` guard the Cancel text does. */}
      <Stack.Screen
        name="new"
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [1],
          sheetGrabberVisible: true,
          sheetCornerRadius: 30,
        }}
      />
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
