import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { WalkthroughChrome } from '@/components/intake/walkthrough-parts';
import { Button, Chip, ErrorState, Rule, Skeleton, Text } from '@/components/ui';
import { PLANS } from '@/features/billing/plans';
import { resolveIntakeCeiling } from '@/features/intake/actions';
import { defaultKeptDraftIds, totalQuantity } from '@/features/intake/ceiling';
import { useDrafts } from '@/features/intake/queries';
import { ceilingCopy, ceilingRows } from '@/features/intake/walkthrough-copy';
import { CARD } from '@/features/intake/walkthrough-spec';
import { useTheme } from '@/theme/tokens';

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
  const theme = useTheme();
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

  // A failed resolve used to throw out of this callback with nothing on
  // screen changing — the button un-busied and the reader was left on a
  // page with no way forward and no way back (2026-09-02 audit).
  const [resolveFailed, setResolveFailed] = useState(false);
  const confirm = useCallback(async () => {
    if (!sessionId) return;
    setResolving(true);
    setResolveFailed(false);
    try {
      await resolveIntakeCeiling(sessionId, confirmed, Array.from(selection));
      router.replace('/reveal');
    } catch {
      setResolveFailed(true);
    } finally {
      setResolving(false);
    }
  }, [sessionId, confirmed, selection, router]);

  /**
   * The named way out of both phases. Neither had one: a reader who arrived
   * here from the review could only go forward, and a reader whose resolve
   * failed could not go anywhere at all. Back returns to the review, whose
   * drafts are unchanged — nothing here is committed until the resolve lands.
   */
  const exit = { label: 'Back', onPress: () => router.back(), hint: 'Returns to your review. Nothing is saved yet.' };

  if (!sessionId) return <ErrorState title="No walkthrough to resolve" />;
  if (drafts.isPending) return <Skeleton />;
  if (drafts.isError) return <ErrorState title="Couldn’t load what you said" />;

  const total = totalQuantity(confirmed);
  // No outfit total is printed here, deliberately: the arithmetic belongs to
  // the Reveal, after the ceiling has been resolved and the closet is settled.
  // Quoting a count for the full spoken closet on this screen would name a
  // figure the active ten will not actually make.

  // ── M-07 ──────────────────────────────────────────────────────────────
  //
  // A CAPACITY FACT, NOT AN UPSELL. No tier is named, no price appears and no
  // upgrade action is drawn — the paywall comes after the Reveal, where the
  // reader has seen what the closet makes. That omission is deliberate and is
  // recorded in the atlas's own deviation ledger.
  if (phase === 'ceiling') {
    const copy = ceilingCopy(total, ceiling, PLANS.free.storedItems);
    const rows = ceilingRows(total, ceiling, PLANS.free.storedItems);
    return (
      <View className="flex-1 bg-canvas">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <WalkthroughChrome exit={exit} />
          <View className="flex-1 px-gutter">
            <Text variant="eyebrow">{copy.eyebrow}</Text>
            <View style={{ marginTop: 6, marginBottom: 12 }}>
              <Text variant="display" trim accessibilityRole="header">
                {copy.headline}
              </Text>
            </View>
            <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
              {copy.body}
            </Text>

            {/* THE ARITHMETIC, AS A BAND. Redesign 24 lifts the three rows off
                the page's own rules and into the blush ground the group gives
                anything that wants a beat — the same object the cap notice and
                the ambiguous count are drawn in. Values right-aligned and set
                in the serif figure cut, labels left; the capacity row is quiet
                because it is context about the plan rather than a figure about
                this closet.

                Still a CAPACITY FACT and not an upsell: no tier is named, no
                price appears, and every number is passed in. */}
            <View
              className="bg-blush"
              style={{ marginTop: 26, borderRadius: CARD.radius, paddingHorizontal: CARD.padding }}>
              {rows.map((row, i) => (
                <View key={row.label}>
                  {i > 0 ? <View style={{ height: 1, backgroundColor: theme.blushRule }} /> : null}
                  <View
                    className="flex-row items-center justify-between"
                    style={{ paddingVertical: 16 }}>
                    <Text
                      variant={row.quiet ? 'note' : 'body'}
                      className="pr-3"
                      style={{ fontSize: 16, flexShrink: 1 }}>
                      {row.label}
                    </Text>
                    <Text
                      variant={row.quiet ? 'note' : 'stat'}
                      className="flex-none"
                      style={{ fontVariant: ['tabular-nums'] }}>
                      {row.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View className="px-gutter">
            <Button
              title={copy.primary}
              onPress={() => setPhase('picking')}
              haptic
              className="self-stretch"
            />
            {/* The default IS a real choice, and taking it must not feel like
                giving up: `defaultKeptDraftIds` is the same seeding the picker
                would open on, so "let Cinch choose" and "open the picker and
                confirm" land on identical closets. */}
            <Button
              title={copy.secondary}
              variant="ghost"
              loading={resolving}
              onPress={() => void confirm()}
              className="self-stretch"
            />
            <Text variant="note" style={{ textAlign: 'center', marginTop: 4, marginBottom: 8 }}>
              {copy.footer}
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // ── M-08 — "Keep ten for now" ───────────────────────────────────────────
  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <WalkthroughChrome exit={exit} state={`${selectedQty} of ${ceiling}`} />
        <View className="px-gutter" style={{ marginBottom: 14 }}>
          <Text variant="display" trim accessibilityRole="header">
            Keep {ceiling} for now.
          </Text>
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
                  selection.has(draft.id) ? 'Move to Storage' : 'Keep this one active'
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
          {resolveFailed ? (
            <View style={{ marginBottom: 10 }} accessibilityRole="alert">
              <Text variant="caption" className="text-muted">
                That didn’t save — nothing moved. Try again, or go back to your review.
              </Text>
            </View>
          ) : null}
          <Button
            title={resolving ? 'Saving…' : resolveFailed ? 'Try again' : `Keep these ${ceiling}`}
            onPress={() => void confirm()}
            disabled={resolving || selectedQty !== ceiling}
            haptic
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
