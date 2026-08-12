import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * CP-02 — the permission ask, before the system sheet.
 *
 * "The ask states what the permission is for, that the following prompt belongs
 * to the system, and where the photograph goes. The second action is a real
 * alternative rather than a decline, so refusing does not end the intake.
 * Nothing is oxblood: this frame asks, it does not sell."
 *
 * ── Why this is a component and not a block inside `capture.tsx` ───────────
 *
 * Because the canonical fixture has to draw THE SAME ASK. A capture route
 * cannot mount the real stage — a live viewfinder produces different bytes on
 * every frame — so a posed copy of this card in a fixture would be a second
 * implementation of a consent-adjacent sentence, free to drift from the one
 * that ships. One component, two call sites, no drift.
 *
 * The card sits on the ink stage rather than floating over a viewfinder,
 * because there is no viewfinder yet: that is the whole state.
 */
export function CameraAsk({
  onAsk,
  onLibrary,
}: {
  /** Raises the system prompt. The frame promises the NEXT screen is the OS's. */
  onAsk: () => void;
  /** A real alternative, not a decline — refusing must not end the intake. */
  onLibrary: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1 justify-center px-gutter">
      <View className="rounded-plate bg-canvas px-5 py-6">
        {/* 30px, between `display` (40) and `title` (28). Inline, never a second
            `text-*` class — NativeWind gives no precedence between two size
            utilities on one element. */}
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 34 }}>
          Cinch needs the camera to photograph a piece.
        </Text>
        <Text variant="note" className="mt-3" style={{ fontSize: 16, lineHeight: 25 }}>
          The next prompt is your phone’s, not ours, and it asks only for the camera. Photographs
          stay in your closet; nothing is posted anywhere.
        </Text>

        {/* INK, NOT OXBLOOD — "this frame asks, it does not sell." */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask for camera access"
          accessibilityHint="Opens your phone’s own camera permission prompt"
          onPress={onAsk}
          style={{ minHeight: 48 }}
          className="mt-5 items-center justify-center rounded-md bg-ink active:opacity-80">
          {/* Inline colour, never `text-canvas`: two colour utilities on one
              element resolve by stylesheet order, not by intent. */}
          <Text variant="body" className="font-semibold" style={{ fontSize: 16, color: theme.canvas }}>
            Ask for camera access
          </Text>
        </Pressable>

        {/* Outlined, so regular weight: Medium is for labels and filled actions. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pick from your library instead"
          onPress={onLibrary}
          style={{ minHeight: 48 }}
          className="mt-2 items-center justify-center rounded-md border border-rule active:opacity-70">
          <Text variant="body" className="text-ink" style={{ fontSize: 16 }}>
            Pick from your library instead
          </Text>
        </Pressable>

        <Text variant="note" className="mt-2.5" style={{ fontSize: 14, lineHeight: 21 }}>
          Picking from your library needs no permission — you choose the pictures and Cinch sees
          only those.
        </Text>
      </View>
    </View>
  );
}
