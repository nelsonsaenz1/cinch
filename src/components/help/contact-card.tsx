import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';

/** The one address, everywhere it is named. */
export const SUPPORT_ADDRESS = 'hello@mail.cinchstyle.com';

/**
 * The tray card at the foot of HS-01 ("Still stuck?") and HS-03 ("Ask us
 * instead") — same object, two sentences.
 *
 * `bg-tray` with no border and `rounded-lg`: the atlas draws a 16px radius on a
 * #F0ECE3 ground with no ring, and `lg` is that radius in the scale. A `Card`
 * would bring `bg-surface` and a `rule` border, which is a different object —
 * this one is recessed, not lifted.
 *
 * The body is `note`, not `caption`. Both are 13px; `caption` carries
 * `font-medium` and would render the atlas's regular weight as bold, which on a
 * quiet closing sentence reads as insistence. See `components/ui/text.tsx:53-68`.
 *
 * The title is a plain `body`, not `body` + `font-medium`. The atlas sets it at
 * weight 500, but `body` already carries `font-body` and a second `font-*` class
 * on the same element is two utilities of the same kind with no defined
 * precedence in NativeWind — the exact hazard `text.tsx:63-68` and
 * `button.tsx:88-94` both record. The hierarchy survives without it: 17px ink
 * over 13px muted is a clear two steps.
 *
 * The button is `variant="ink"` — the atlas's #1C1A16 fill. It does not spend
 * the screen's one oxblood, which on the answer page belongs to the related
 * links.
 */
export function HelpContactCard({
  title,
  body,
  actionLabel = 'Write to us',
  onPress,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onPress: () => void;
}) {
  return (
    <View className="rounded-lg bg-tray p-4">
      <Text variant="body">{title}</Text>
      <Text variant="note" className="mt-1.5">
        {body}
      </Text>
      <Button title={actionLabel} variant="ink" onPress={onPress} className="mt-3.5 self-start" />
    </View>
  );
}
