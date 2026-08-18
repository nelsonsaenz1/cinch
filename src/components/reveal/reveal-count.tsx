import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The count, its derivation, and the composition it came from. Redesign 12.
 *
 * ── WHAT CHANGED, AND WHY ───────────────────────────────────────────────────
 *
 * This used to draw a SENTENCE as the hero — "Ten pieces. Fourteen outfits." —
 * with the derivation beneath it. The accepted frames make the NUMBER the hero
 * and the sentence the derivation, and that is the better arrangement for one
 * reason: the sentence was doing both jobs at once and doing neither cleanly.
 * A reader who has just photographed ten things wants the answer first and the
 * arithmetic second, and a headline that contains both makes them read the
 * question again before they get the answer.
 *
 * ── ONE ANNOUNCEMENT, NOT THREE ─────────────────────────────────────────────
 *
 * The number, the derivation and the chips are a SINGLE accessible node. A
 * screen reader that says "twenty-seven" and then, separately, "twenty-seven
 * outfits from ten pieces", and then four chips, has said the same fact four
 * times and buried it. The `accessibilityLabel` is the derivation with the
 * composition spelled into it, which is the sentence a sighted reader
 * assembles from the same three parts.
 *
 * Every figure here is a PROP, never computed inline — callers pass what
 * `outfit-count.ts` and `reveal-spec.ts` already worked out, so this component
 * cannot drift into doing its own arithmetic.
 */
export function RevealCount({
  count,
  fontSize,
  derivation,
  chips,
  spokenLabel,
  offlineMark,
  large = false,
  showNumber = true,
}: {
  /** Already resolved by `countOutfits(tallyOf(items))`. Never estimated here. */
  count: number;
  /** From `displayFontSize` — stepped down for three digits, plates or AX. */
  fontSize: number;
  derivation: string;
  chips: string[];
  /** The number and its reason as one sentence, for VoiceOver. */
  spokenLabel: string;
  /** "You're offline. This was worked out on your phone." — or null. */
  offlineMark?: string | null;
  large?: boolean;
  /**
   * False during `computing`, where a digit — or anything digit-shaped — would
   * be a claim about a number that has not resolved.
   */
  showNumber?: boolean;
}) {
  const theme = useTheme();

  return (
    <View accessible accessibilityRole="header" accessibilityLabel={spokenLabel}>
      {showNumber ? (
        <Text
          variant="wordmark"
          trim
          // Explicitly excluded from the announcement: the label above already
          // says "twenty-seven outfits", and a bare "27" read out first is the
          // same fact twice in two registers.
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ fontSize, lineHeight: fontSize * 1.02 }}>
          {String(count)}
        </Text>
      ) : null}

      <Text
        variant="note"
        style={{
          marginTop: showNumber ? 14 : 0,
          fontSize: large ? 21 : 15,
          lineHeight: large ? 29 : 23,
        }}>
        {derivation}
      </Text>

      {/* The mark, not a banner. Offline changes nothing about the arithmetic
          — it was all computed on this phone — so it gets a line rather than a
          notice with a retry that would have nothing to retry. */}
      {offlineMark ? (
        <Text variant="note" style={{ marginTop: 10, color: theme.muted, fontSize: large ? 19 : 14 }}>
          {offlineMark}
        </Text>
      ) : null}

      {chips.length > 0 ? (
        // Outlined here, tray in the Walkthrough — the same composition chip in
        // its two grounds. r12, never a capsule. Present kinds only: a kind the
        // closet does not have is absent rather than printed as a zero.
        <View
          className="flex-row flex-wrap"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{ marginTop: large ? 16 : 20, gap: 8 }}>
          {chips.map((chip) => (
            <View
              key={chip}
              className="border border-rule items-center justify-center"
              style={{
                borderRadius: 12,
                paddingHorizontal: 12,
                minHeight: large ? 52 : 34,
              }}>
              <Text variant="note" style={{ fontSize: large ? 18 : 14 }}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Beat two — the engine described in words, because a digit here would lie.
 *
 * There is deliberately no skeleton, no shimmer and no dash. A digit-shaped
 * placeholder is itself a claim: it says a number is coming and it is about
 * this wide, and on a closet that turns out to make none that claim was false
 * for every frame it was on screen.
 */
export function RevealComputing({
  title,
  body,
  large = false,
}: {
  title: string;
  body: string;
  large?: boolean;
}) {
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={`${title} ${body}`}>
      <Text variant="display" trim style={large ? { fontSize: 34, lineHeight: 40 } : undefined}>
        {title}
      </Text>
      <Text
        variant="note"
        style={{ marginTop: 14, fontSize: large ? 21 : 15, lineHeight: large ? 29 : 23 }}>
        {body}
      </Text>
    </View>
  );
}
