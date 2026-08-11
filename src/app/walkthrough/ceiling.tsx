import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Chip, ErrorState, Rule, Skeleton, Text } from '@/components/ui';
import { resolveIntakeCeiling } from '@/features/intake/actions';
import { defaultKeptDraftIds, tallyOfDrafts, totalQuantity } from '@/features/intake/ceiling';
import { countOutfits } from '@/features/closet/outfit-count';
import { useDrafts } from '@/features/intake/queries';

/**
 * M-07 / M-08 — the ceiling after a large voice intake.
 *
 * One route, two phases, for the same reason the Walkthrough itself is one
 * route (see `walkthrough/index.tsx`): M-07 is a beat, not a screen someone
 * navigates away from and back to, and M-08 is what M-07's one action opens.
 *
 * Reached only when `commitIntake`'s first call returned `held > 0` —
 * `review.tsx` routes here instead of straight to `/reveal` in that case, and
 * nowhere else. A closet that fit under the ceiling never sees this route.
 *
 * See docs/design/reframe-directive.md §11 "F/G" — M-07's copy and the
 * "keep ten for now" name are both specified there, not invented here.
 */
export default function CeilingScreen() {
  const router = useRouter();
  const { session, committed: committedParam } = useLocalSearchParams<{
    session?: string;
    committed?: string;
  }>();
  const sessionId = session ?? null;

  // The ceiling this walkthrough actually hit, from the commit that sent us
  // here — not re-derived, and not assumed to be ten. Paid plans have a
  // higher ceiling than free; this screen only ever appears because SOME
  // ceiling fired, whatever its number.
  const ceiling = Number(committedParam ?? 0);

  const drafts = useDrafts(sessionId);
  const confirmed = useMemo(
    () => (drafts.data ?? []).filter((d) => d.state === 'confirmed'),
    [drafts.data],
  );

  const [phase, setPhase] = useState<'ceiling' | 'picking'>('ceiling');
  const [kept, setKept] = useState<Set<string> | null>(null);
  const [resolving, setResolving] = useState(false);

  const selection = kept ?? defaultKeptDraftIds(confirmed, ceiling || confirmed.length);
  const selectedQty = confirmed
    .filter((d) => selection.has(d.id))
    .reduce((sum, d) => sum + Math.max(d.quantity, 1), 0);

  const toggle = useCallback(
    (id: string, qty: number) => {
      const next = new Set(selection);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // A held draft can't be added if it would push the total over the
        // ceiling — swap something out first. Silently refusing the tap
        // (rather than allowing an over-ceiling selection the confirm button
        // then has to reject) keeps the running count always legible as
        // "how many more can I add", never negative.
        if (selectedQty + qty > ceiling) return;
        next.add(id);
      }
      setKept(next);
    },
    [selection, selectedQty, ceiling],
  );

  const confirm = useCallback(async () => {
    if (!sessionId) return;
    setResolving(true);
    try {
      await resolveIntakeCeiling(sessionId, confirmed, Array.from(selection));
      router.replace('/reveal');
    } finally {
      setResolving(false);
    }
  }, [sessionId, confirmed, selection, router]);

  if (!sessionId) return <ErrorState title="No walkthrough to resolve" />;
  if (drafts.isPending) return <Skeleton />;
  if (drafts.isError) return <ErrorState title="Couldn’t load what you said" />;

  const total = totalQuantity(confirmed);
  const outfitCount = countOutfits(tallyOfDrafts(confirmed));

  // ── M-07 ──────────────────────────────────────────────────────────────
  if (phase === 'ceiling') {
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 justify-end">
          <View className="px-gutter">
            <View style={{ marginBottom: 10 }}>
              <Text variant="display">
                You own {total} {total === 1 ? 'piece' : 'pieces'}.
              </Text>
            </View>
            <Text variant="body" className="text-muted">
              {outfitCount > 0
                ? `That's ${outfitCount} outfits. Cinch is holding all ${total}. Free keeps ${ceiling} of them awake.`
                : `Cinch is holding all ${total}. Free keeps ${ceiling} of them awake.`}
            </Text>
            <View style={{ marginTop: 24 }}>
              <Button
                title={`Choose which ${ceiling}`}
                onPress={() => setPhase('picking')}
                haptic
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── M-08 — "Keep ten for now" ───────────────────────────────────────────
  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="px-gutter" style={{ marginBottom: 14 }}>
          <Text variant="display">Keep {ceiling} for now.</Text>
          <View style={{ marginTop: 6 }}>
            <Text variant="body" className="text-muted">
              Tap to swap. Nothing you spoke is deleted — the rest waits in Storage until you
              want it.
            </Text>
          </View>
        </View>
        <Rule />
        <ScrollView contentContainerClassName="px-gutter" style={{ flex: 1, marginTop: 14 }}>
          <View className="flex-row flex-wrap gap-2">
            {confirmed.map((draft) => (
              <Chip
                key={draft.id}
                label={draft.name}
                count={draft.quantity > 1 ? draft.quantity : undefined}
                selected={selection.has(draft.id)}
                onPress={() => toggle(draft.id, Math.max(draft.quantity, 1))}
                accessibilityHint={
                  selection.has(draft.id) ? 'Move to Storage' : 'Keep this one awake'
                }
              />
            ))}
          </View>
        </ScrollView>
        <View className="px-gutter">
          <View style={{ marginBottom: 10 }}>
            <Text variant="caption" className="text-muted">
              {selectedQty} of {ceiling}
            </Text>
          </View>
          <Button
            title={resolving ? 'Saving…' : `Keep these ${ceiling}`}
            onPress={() => void confirm()}
            disabled={resolving || selectedQty !== ceiling}
            haptic
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
