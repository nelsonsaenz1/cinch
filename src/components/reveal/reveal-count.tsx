import { View } from 'react-native';

import { Text } from '@/components/ui/text';

/**
 * R-02 / R-04 — the count, in the largest type anywhere in the app.
 *
 * THE DERIVATION SITS DIRECTLY UNDER THE HEADLINE, never in a footnote, so the
 * number and its proof are read together: "a number with no derivation is
 * indistinguishable from a slogan."
 *
 * Every figure here is a prop, never computed inline — callers pass what
 * `outfit-count.ts` and `reveal-copy.ts` already worked out, so this component
 * cannot drift into doing its own arithmetic.
 */
export function RevealCount({
  headline,
  derivation,
  chips,
}: {
  /** "Ten pieces. Fourteen outfits." — from `headline()`. */
  headline: string;
  /** The sentence that derives it — `defaultDerivation`/`substitutionDerivation`. */
  derivation: string;
  chips: string[];
}) {
  return (
    <View>
      <Text variant="wordmark" trim accessibilityRole="header" style={{ fontSize: 46 }}>
        {headline}
      </Text>
      <Text variant="note" style={{ marginTop: 14, fontSize: 17, lineHeight: 26 }}>
        {derivation}
      </Text>

      {chips.length > 0 ? (
        // Outlined here, tray in the Walkthrough — the same composition chip in
        // its two grounds. r12, never a capsule. Present kinds only: a kind the
        // closet does not have is absent rather than printed as a zero.
        <View className="flex-row flex-wrap" style={{ marginTop: 20, gap: 8 }}>
          {chips.map((chip) => (
            <View
              key={chip}
              className="border border-rule"
              style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text variant="note" style={{ fontSize: 14 }}>
                {chip}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
