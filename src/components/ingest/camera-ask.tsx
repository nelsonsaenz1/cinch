import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { PageActions } from '@/components/ingest/capture-parts';
import { CAPTURE } from '@/features/ingest/capture-spec';
import { leading } from '@/theme/font-metrics';
import { useTheme } from '@/theme/tokens';

/**
 * Frame 01 — the permission ask, before the system sheet.
 *
 * "camera-ask, shown before the system prompt so the prompt is never spent
 * blind. Both fallbacks are offered here, not hidden behind a refusal."
 *
 * ── WHAT REDESIGN 22 CHANGED ────────────────────────────────────────────────
 *
 * CP-02 drew this as a canvas card floating on the ink stage, with a 30px
 * headline naming the permission ("Cinch needs the camera to photograph a
 * piece") and two outlined controls. Frame 01 puts it on paper, leads with the
 * INSTRUCTION rather than the request — "Lay it flat and take one picture." —
 * draws the shot it is asking for as a tray well with corner marks in it, and
 * offers all three doors: the oxblood ask, the tinted library, and describe as
 * a quiet third.
 *
 * The oxblood is new and is the directive's own correction ("colour becomes
 * structural"). CP-02's "nothing is oxblood: this frame asks, it does not sell"
 * was a rule about the one-accent-per-screen law that the directive repeals;
 * what the sentence was protecting — that the second action is a real
 * alternative and not a decline — is protected instead by drawing BOTH
 * fallbacks, which is what the frame's annotation insists on.
 *
 * ── WHAT IT DID NOT CHANGE ──────────────────────────────────────────────────
 *
 * That the next prompt belongs to the system, and that the photograph goes to
 * the user's own closet and nowhere else. The frame's body says the second half
 * ("the picture goes straight into your own closet"); the first half is carried
 * on the ask's accessibility hint, where it is read to exactly the person about
 * to be handed an OS alert they did not expect.
 *
 * ── WHY THIS IS A COMPONENT AND NOT A BLOCK INSIDE `capture.tsx` ───────────
 *
 * Because the canonical fixture has to draw THE SAME ASK. A capture route
 * cannot mount the real stage — a live viewfinder produces different bytes on
 * every frame — so a posed copy of this card in a fixture would be a second
 * implementation of a consent-adjacent sentence, free to drift from the one
 * that ships. One component, two call sites, no drift.
 */
export function CameraAsk({
  onAsk,
  onLibrary,
  onDescribe,
}: {
  /** Raises the system prompt. The hint promises the NEXT screen is the OS's. */
  onAsk: () => void;
  /** A real alternative, not a decline — refusing must not end the intake. */
  onLibrary: () => void;
  /** The third door, quiet: a garment nobody will get round to photographing. */
  onDescribe?: () => void;
}) {
  const theme = useTheme();

  return (
    <View className="flex-1">
      {/* The shot being asked for, drawn rather than described — a tray well at
          the plate radius with the same four corner marks the live stage uses,
          so the instruction and the viewfinder are visibly the same request. */}
      <View className="px-gutter">
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="items-center justify-center overflow-hidden rounded-plate bg-tray"
          style={{ height: 170 }}>
          <View
            style={{
              width: 200,
              height: 120,
            }}>
            {(
              [
                ['tl', { top: 0, left: 0 }, { borderLeftWidth: 2, borderTopWidth: 2 }],
                ['tr', { top: 0, right: 0 }, { borderRightWidth: 2, borderTopWidth: 2 }],
                ['bl', { bottom: 0, left: 0 }, { borderLeftWidth: 2, borderBottomWidth: 2 }],
                ['br', { bottom: 0, right: 0 }, { borderRightWidth: 2, borderBottomWidth: 2 }],
              ] as const
            ).map(([key, pos, borders]) => (
              <View
                key={key}
                style={{
                  position: 'absolute',
                  width: 28,
                  height: 28,
                  borderColor: theme.ghost,
                  ...pos,
                  ...borders,
                }}
              />
            ))}
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name="tshirt"
                size={56}
                tintColor={CAPTURE.tileFilledAlt}
                resizeMode="scaleAspectFit"
              />
            </View>
          </View>
        </View>
      </View>

      <View className="px-gutter" style={{ paddingTop: 20 }}>
        <Text variant="title" trim style={{ fontSize: 32, lineHeight: leading('instrument', 32, 1.05) }}>
          Lay it flat and take one picture.
        </Text>
        <Text
          variant="note"
          className="mt-3"
          style={{ fontSize: 15, lineHeight: leading('helvetica', 15, 1.5) }}>
          Cinch opens the camera only while you’re photographing a piece, and the picture goes
          straight into your own closet.
        </Text>
      </View>

      <View className="flex-1" />

      <View style={{ paddingBottom: 8 }}>
        {/* The half of CP-02's sentence the frame drops rides the ask's own
            hint, where it is read to exactly the person about to be handed an
            OS alert they did not expect. */}
        <PageActions
          primary="Open the camera"
          primaryHint="The next prompt is your phone’s, not ours, and it asks only for the camera"
          onPrimary={onAsk}
          secondary="Choose from your library"
          secondaryHint="Opens the system picker. This asks for no permission — you choose the pictures and Cinch sees only those."
          onSecondary={onLibrary}
          quiet={onDescribe ? 'Describe it instead' : null}
          onQuiet={onDescribe}
        />
      </View>
    </View>
  );
}
