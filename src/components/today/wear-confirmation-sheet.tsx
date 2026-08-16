import { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

type WearConfirmationSheetProps = {
  visible: boolean;
  outfitName: string;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (feedback: { rating: number | null; favorite: boolean }) => void;
};

/**
 * One honest confirmation before a wear becomes history.
 *
 * Rating and favorite are deliberately optional. Closing this sheet records
 * nothing; confirming with no feedback still records the wear without
 * inventing a taste signal.
 */
export function WearConfirmationSheet({
  visible,
  outfitName,
  pending,
  error,
  onCancel,
  onConfirm,
}: WearConfirmationSheetProps) {
  const theme = useTheme();
  const [rating, setRating] = useState<number | null>(null);
  const [favorite, setFavorite] = useState(false);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={pending ? undefined : onCancel}>
      <View className="flex-1 justify-end bg-black/30">
        <SafeAreaView
          edges={['bottom']}
          className="max-h-[88%] rounded-t-[28px] bg-canvas"
          accessibilityViewIsModal>
          <ScrollView contentContainerClassName="px-gutter pb-5 pt-6">
            <View className="flex-row items-start justify-between gap-4">
              <View className="flex-1">
                <Text variant="eyebrow">MARK AS WORN</Text>
                <Text variant="title" className="mt-2" accessibilityRole="header">
                  {outfitName}
                </Text>
              </View>
              <Pressable
                onPress={onCancel}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                hitSlop={12}
                style={{ minWidth: MIN_TAP_TARGET, minHeight: MIN_TAP_TARGET }}
                className="items-end justify-center">
                <Text variant="label">Cancel</Text>
              </Pressable>
            </View>

            <View className="mt-8">
              <Text variant="heading">How did it feel?</Text>
              <Text variant="note" className="mt-1">
                Optional — your rating helps Cinch learn your taste.
              </Text>
              <View className="mt-4 flex-row justify-between" accessibilityRole="radiogroup">
                {[1, 2, 3, 4, 5].map((value) => {
                  const selected = rating === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setRating(selected ? null : value)}
                      disabled={pending}
                      accessibilityRole="radio"
                      accessibilityLabel={`${value} ${value === 1 ? 'star' : 'stars'}`}
                      accessibilityState={{ selected }}
                      style={{
                        minWidth: MIN_TAP_TARGET,
                        minHeight: MIN_TAP_TARGET,
                        borderColor: selected ? theme.accent : theme.ruleStrong,
                        backgroundColor: selected ? theme.blush : theme.canvas,
                      }}
                      className="items-center justify-center rounded-full border">
                      <Text variant="heading" style={{ color: selected ? theme.accent : theme.muted }}>
                        ★
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View className="mt-7 flex-row items-center justify-between gap-5 rounded-lg bg-tray px-4 py-4">
              <View className="flex-1">
                <Text variant="heading">Favorite this outfit</Text>
                <Text variant="note" className="mt-1">
                  Keep it in your private Favorite outfits rail.
                </Text>
              </View>
              <Switch
                value={favorite}
                onValueChange={setFavorite}
                disabled={pending}
                trackColor={{ false: theme.ruleStrong, true: theme.accent }}
                accessibilityLabel="Favorite this outfit"
              />
            </View>

            {error ? (
              <Text
                variant="note"
                className="mt-4"
                style={{ color: theme.critical }}
                accessibilityRole="alert">
                {error}
              </Text>
            ) : null}

            <Button
              title="Log this wear"
              className="mt-6"
              loading={pending}
              onPress={() => onConfirm({ rating, favorite })}
            />
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
