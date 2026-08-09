import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * The full AI-processing policy — frame A-02 of the consent redesign.
 *
 * A page, not a modal, and short enough to finish: four headings in the order
 * people actually ask them (what is sent, what we keep, what they keep, what
 * never happens), then the one honest caveat about turning it off later.
 *
 * Rendered as a full-screen paper surface INSIDE the consent sheet's Modal —
 * the sheet stays mounted underneath, and backing out returns to A-01 with
 * neither choice made. Exported on its own so a Settings or Privacy screen can
 * push the same page later without dragging the sheet along.
 */
const SECTIONS = [
  {
    eyebrow: 'Sent',
    body: 'The garment photo, at reduced resolution. Nothing else — no name, no email, no location, no other item in your closet.',
  },
  {
    eyebrow: 'Stored by us',
    body: 'The original photo and the returned tags, in your closet. Friends you share with see the photo and tags of items you lend, and nothing more.',
  },
  {
    eyebrow: 'Stored by them',
    body: 'That is between Cinch and our AI partner, and it is governed by our agreement with them rather than by anything Cinch can enforce on your behalf. We send the least we can — one photo, at reduced resolution, with nothing attached to it.',
  },
  {
    eyebrow: 'Never',
    body: 'Sold, advertised against, or used to identify a person. We don’t run face recognition, here or anywhere in Cinch.',
  },
] as const;

export function AiPolicyPage({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark" style={{ paddingTop: insets.top }}>
      {/* Nav row — the circular back disc every pushed page carries, with the
          serif wordmark centred between it and a matching spacer. */}
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <BackButton onPress={onBack} label="Back to consent" />
        <Text variant="plate">Cinch</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerClassName="px-gutter pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <Text variant="display" trim>
          What we send, keep and never do
        </Text>

        <View className="mt-7">
          {SECTIONS.map(({ eyebrow, body }, index) => (
            <View
              key={eyebrow}
              className={index === 0 ? '' : 'mt-6 border-t border-rule pt-6 dark:border-rule-dark'}>
              <Text variant="eyebrow">{eyebrow}</Text>
              {/* Tone as an inline style, not a stacked `text-muted` — same
                  precedence hazard as the sheet's lede. */}
              <Text variant="callout" className="mt-2" style={{ color: theme.muted }}>
                {body}
              </Text>
            </View>
          ))}
        </View>

        {/* The caveat, in a filled card rather than another hairline section:
            it is the one sentence here that qualifies a promise, so it sits
            visually apart from the four flat statements above it. */}
        <View className="mt-7 rounded-lg bg-sand p-4 dark:bg-sand-dark">
          <Text variant="label" className="font-body" style={{ color: theme.muted }}>
            Turning tagging off later stops new photos being sent. It doesn’t un-send old ones — but
            you can delete any item, and its photo and tags go with it.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
