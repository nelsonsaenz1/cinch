import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { slotCopy, slotOrdinalWithinKind } from '@/features/onboarding/ten-copy';
import { settledCount, type TenSlot } from '@/features/onboarding/ten-slots';
import { useTheme } from '@/theme/tokens';

/** One L of the framing guide — transcribed from capture.tsx's `Corner`. */
function Corner({ canvas, pos }: { canvas: string; pos: 'tl' | 'tr' | 'bl' | 'br' }) {
  const edges = {
    tl: { top: 20, left: 20, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
    tr: { top: 20, right: 20, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 4 },
    bl: { bottom: 20, left: 20, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 4 },
    br: { bottom: 20, right: 20, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 4 },
  } as const;
  return (
    <View
      style={{
        position: 'absolute',
        width: 22,
        height: 22,
        borderColor: canvas,
        opacity: 0.55,
        ...edges[pos],
      }}
    />
  );
}

/**
 * T-03's chrome — the dark stage, corner guides, the ten-segment rule and the
 * bottom sheet — as a shell around whichever stage content the caller
 * supplies (a live `CameraView` in production, a still image in the dev
 * route). Keeping the two apart is what lets `dev-ten` render this state
 * without a camera session.
 */
export function TenCameraChrome({
  slot,
  slots,
  phase,
  onCancel,
  stage,
  onLibrary,
  onShoot,
  shooting = false,
  shutterEnabled = true,
}: {
  slot: TenSlot;
  slots: readonly TenSlot[];
  /** "Cleaning up…" while a previous shot is still processing; null once idle. */
  phase: string | null;
  onCancel: () => void;
  /** The live preview or a stand-in image — this component draws nothing itself. */
  stage: React.ReactNode;
  /** Omitted in the dev fixture, where the row is drawn but does nothing. */
  onLibrary?: () => void;
  onShoot?: () => void;
  shooting?: boolean;
  shutterEnabled?: boolean;
}) {
  const theme = useTheme();
  const n = slotOrdinalWithinKind(slots, slot.id);
  const phrase = slotCopy(slot.kind, n).phrase;
  const filled = settledCount(slots);

  return (
    // A real SafeAreaView, not a plain View — capture.tsx's own reasoning:
    // the dark stage is the one screen where the status bar sits directly on
    // the app's content rather than on the light masthead, and this render
    // happens on top of the-ten.tsx's own screen rather than as a routed
    // page, so it never inherited a SafeAreaView from anywhere upstream.
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-ink">
      <View className="flex-row items-center justify-between px-gutter pt-1">
        <Text variant="plate" style={{ color: theme.canvas, fontSize: 26 }}>
          {`Slot ${slot.id} · ${phrase}`}
        </Text>
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          hitSlop={12}
          className="py-2">
          {/* Regular 17 — a text-only control, per reference board A. Hand-rolled
              only because `ghost`'s `muted` label is unreadable on the ink stage. */}
          <Text variant="body" style={{ color: theme.canvas }}>
            Cancel
          </Text>
        </Pressable>
      </View>

      {/* `ink`, not the atlas's `#100F0D` — the reconciliation table calls
          this well out by name: "the 3-step delta is invisible under a
 photo" (free-tier-contract.md §3). */}
      <View
        style={{
          position: 'relative',
          margin: 16,
          flex: 1,
          borderRadius: 20,
          overflow: 'hidden',
          backgroundColor: theme.ink,
        }}>
        {stage}
        <Corner canvas={theme.canvas} pos="tl" />
        <Corner canvas={theme.canvas} pos="tr" />
        <Corner canvas={theme.canvas} pos="bl" />
        <Corner canvas={theme.canvas} pos="br" />
        <Text
          className="absolute"
          style={{
            bottom: 22,
            left: 0,
            right: 0,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: '500',
            color: 'rgba(251,250,246,0.75)',
            textShadowColor: 'rgba(28,26,22,0.55)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 4,
          }}>
          One garment, plain background
        </Text>
      </View>

      {/* Library · shutter. "Describe" is /capture's third door, not this
 one's — the guided flow keeps to the two ways that produce a
          photograph for the slot on screen. */}
      <View className="flex-row items-center justify-between px-8 py-2">
        <Pressable
          onPress={onLibrary}
          disabled={!onLibrary}
          accessibilityRole="button"
          accessibilityLabel="Choose from library"
          hitSlop={12}
          style={{ minWidth: 64 }}
          className="py-2">
          <Text variant="label" style={{ color: theme.canvas }}>
            Library
          </Text>
        </Pressable>
        <Pressable
          onPress={onShoot}
          disabled={!shutterEnabled || shooting}
          accessibilityRole="button"
          accessibilityLabel="Take a photo"
          accessibilityState={{ disabled: !shutterEnabled, busy: shooting }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            borderWidth: 3,
            borderColor: theme.canvas,
            opacity: shutterEnabled ? 1 : 0.35,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: theme.canvas,
              opacity: shooting ? 0.5 : 1,
            }}
          />
        </Pressable>
        <View style={{ minWidth: 64 }} />
      </View>

      {/* The ten read as a rule under the frame — filled segments solid, the
          slot being shot outlined, the rest at low opacity. */}
      <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 8 }}>
        {slots.map((s) => (
          <View
            key={s.id}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                s.id === slot.id
                  ? 'rgba(251,250,246,0.9)'
                  : s.status !== 'empty'
                    ? theme.canvas
                    : 'rgba(251,250,246,0.28)',
              borderWidth: s.id === slot.id ? 1 : 0,
              borderColor: theme.canvas,
            }}
          />
        ))}
      </View>

      <View
        className="rounded-t-plate bg-surface px-gutter pb-8 pt-4"
        style={{ paddingBottom: 34 }}>
        <View className="flex-row items-baseline justify-between">
          <Text variant="plate" style={{ fontSize: 24 }}>
            {phase ?? 'Ready'}
          </Text>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '500',
              // `muted`, not `faint` — this count is real content, not a
              // decorative mark, and `faint` fails AA at this size (see the
              // standing refusal in free-tier-contract.md §4).
              color: theme.muted,
              fontVariant: ['tabular-nums'],
            }}>
            {`${filled} of ${slots.length} filled`}
          </Text>
        </View>
        <Text variant="body" className="mt-2 text-muted">
          {phase
            ? `It lands in slot ${slot.id} when it’s done. Keep going — you don’t have to wait for it.`
            : 'Frame one garment against a plain background, then shoot.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}
