import { Image } from 'expo-image';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import {
  BORROW_ACTION,
  BORROW_CONSEQUENCE,
  lendsLine,
  type FriendItemView,
} from '@/features/social-graph/friend-item-view';

/**
 * IT-04 — a friend's garment, as a document.
 *
 * The same page as IT-01 with cells removed rather than a different page: the
 * hero, the title, the descriptive line and the wear figure are in the same
 * order and the same voice. What is gone is gone completely — no blurred price,
 * no lock icon, no "hidden" row. A cell that announces its own absence is still
 * a cell about somebody's money.
 *
 * THE OVERFLOW MENU IS ABSENT TOO, and for the same reason: every action it
 * held — edit, archive, mark for sale, delete — belongs to the owner. There is
 * no viewer-facing subset of it worth keeping.
 */
export function FriendItemDocument({
  view,
  ownerName,
  imageUri,
  onAsk,
  onFindIt,
  asking,
}: {
  view: FriendItemView;
  /** How the owner is named to this viewer — display name, else handle. */
  ownerName: string;
  imageUri?: string;
  onAsk: () => void;
  onFindIt: () => void;
  asking?: boolean;
}) {
  return (
    <View className="px-gutter">
      <Text variant="eyebrow">{`In ${ownerName}’s closet`}</Text>

      <View className="mt-4 aspect-square overflow-hidden rounded-lg bg-tray">
        {imageUri ? (
          <Image
            source={stableImageSource(imageUri)}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            accessibilityIgnoresInvertColors
          />
        ) : null}
      </View>

      <Text variant="title" trim className="mt-5">
        {view.title}
      </Text>
      <Text variant="body" className="mt-1 text-muted">
        {view.line}
      </Text>

      {/* The one figure that crosses. A count with its unit under it, in the
          display face — never a bar, and absent entirely at zero. */}
      {view.wears !== null ? (
        <View className="mt-6 border-t border-hairline pt-4">
          <Text variant="plate">{view.wears}</Text>
          <Text variant="note" className="mt-0.5">
            {view.wears === 1 ? 'wear' : 'wears'}
          </Text>
        </View>
      ) : null}

      {/* Lending. Drawn only when the owner has offered this piece: a garment
          she has not offered carries nothing here at all — no disabled button
          and no explanation of a decision that is hers and was not asked
          about. */}
      {view.borrow === 'lent' ? (
        <View className="mt-7 border-t border-rule pt-5">
          <Text variant="label" className="text-ink">
            {lendsLine(ownerName)}
          </Text>
          {/* What the tap does, before the tap. Nothing is held on a pending
              request, and this says so rather than letting a borrower assume
              otherwise. */}
          <Text variant="body" className="mt-2 text-muted">
            {BORROW_CONSEQUENCE}
          </Text>
          <View className="mt-4">
            <Button title={BORROW_ACTION} loading={asking} haptic onPress={onAsk} />
          </View>
        </View>
      ) : null}

      {/* Commerce, only where both people have said yes — the owner's
          `shoppable` and the viewer's own "Show where to buy". Off by either
          means no row, not a greyed one. */}
      {view.commerce === 'find_it' ? (
        <View className="mt-4">
          <Button title="Find one like it" variant="ghost" onPress={onFindIt} />
        </View>
      ) : null}
    </View>
  );
}
