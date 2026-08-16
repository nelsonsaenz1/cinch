import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendItemDocument } from '@/components/social/friend-item-document';
import { Text } from '@/components/ui/text';
import { friendItemView } from '@/features/social-graph/friend-item-view';
import type { FriendItem } from '@/features/social-graph/types';

/**
 * IT-04 — friend view, borrowable, plus the two states the atlas implies.
 *
 * The frame the atlas draws is the borrowable one. The other two are here
 * because they are the states a reviewer has to be able to check are TRUTHFUL
 * rather than decorated: a piece the owner does not lend carries no lending
 * block at all, and a piece whose owner has not opted into `shoppable` carries
 * no commerce row. Both are absences, which is exactly what makes them worth
 * drawing side by side — an absence is invisible in a single frame.
 *
 * `friendItemView` is the real selector, so what is posed here is the DATA a
 * `friend_items` row can actually carry, not a hand-built view object.
 */
const BASE: FriendItem = {
  id: 'it-04',
  userId: 'priya',
  category: 'Outerwear',
  subcategory: 'Overshirt jacket',
  colors: [],
  pattern: null,
  material: 'oat cotton twill',
  brand: null,
  seasons: [],
  occasions: [],
  description: null,
  thumbPath: null,
  cutoutPath: null,
  platePath: null,
  borrowable: true,
  createdAt: '2026-03-02T00:00:00.000Z',
  wearCount: 18,
  lastWornAt: '2026-08-01T00:00:00.000Z',
  shoppable: false,
};

const VIEWER = { userId: 'me', showWhereToBuy: true };

export default function DevW3G3It04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const frames: [string, FriendItem][] = [
    ['IT-04 — borrowable', BASE],
    ['Not lent — no block, no disabled button', { ...BASE, borrowable: false }],
    ['Owner opted into Find it', { ...BASE, shoppable: true }],
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16 pt-6">
        {frames.map(([label, item], i) => (
          <View key={label} className={i > 0 ? 'mt-14' : ''}>
            <Text variant="eyebrow" className="mb-4 px-gutter">
              {label}
            </Text>
            <FriendItemDocument
              view={friendItemView(item, VIEWER)}
              ownerName="Priya"
              onAsk={() => {}}
              onFindIt={() => {}}
            />
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
