import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { profileName, type BorrowThread } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

export type BorrowRequestRowProps = {
  thread: BorrowThread;
  /** Signed URL for the garment thumb — storage paths are not URLs. */
  imageUri?: string;
  /** Any lifecycle write for this row is in flight. */
  busy?: boolean;
  onLend?: (thread: BorrowThread) => void;
  onDecline?: (thread: BorrowThread) => void;
  onReturned?: (thread: BorrowThread) => void;
  onCancel?: (thread: BorrowThread) => void;
};

/**
 * One borrow request through its whole life. The lifecycle verbs are canned
 * and one-tap on purpose — softening rejection is the reason this flow is
 * structured at all — and the settled states read as facts, not verdicts:
 * a decline says "Not this time", an expiry never says anything.
 *
 * Only the owner gets "Mark returned" (the transition trigger allows her side
 * alone); the borrower's row shows the loan as a state instead.
 */
export function BorrowRequestRow({
  thread,
  imageUri,
  busy = false,
  onLend,
  onDecline,
  onReturned,
  onCancel,
}: BorrowRequestRowProps) {
  const theme = useTheme();
  const { request, direction, counterpart, item } = thread;

  const name = counterpart ? profileName(counterpart) : 'A former friend';
  const garment = item?.subcategory ?? item?.category ?? 'a piece';

  const headline =
    direction === 'incoming' ? `${name} asked to borrow` : `You asked ${name} for`;

  // The settled states, as quiet colophon lines. Pending/approved get controls.
  const stateLine: string | null =
    request.status === 'approved'
      ? direction === 'incoming'
        ? `On loan to ${name}`
        : `Borrowed from ${name}`
      : request.status === 'declined'
        ? 'Not this time'
        : request.status === 'canceled'
          ? 'Withdrawn'
          : request.status === 'returned'
            ? 'Returned'
            : null;

  return (
    <View className="px-4 py-3.5">
      <View className="flex-row gap-3">
        <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-md bg-tray">
          {imageUri ? (
            <Image
              source={stableImageSource(imageUri)}
              contentFit="contain"
              transition={150}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <SymbolView
              name="tshirt"
              size={20}
              tintColor={theme.hairline}
              resizeMode="scaleAspectFit"
            />
          )}
        </View>

        <View className="flex-1">
          <Text variant="caption" className="text-faint">
            {headline}
          </Text>
          <Text variant="body" numberOfLines={1} className="mt-0.5">
            {garment}
          </Text>
          {request.message ? (
            <Text variant="caption" numberOfLines={2} className="mt-1 text-muted">
              &ldquo;{request.message}&rdquo;
            </Text>
          ) : null}
          {stateLine ? (
            <Text variant="colophon" className="mt-1.5">
              {stateLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* The live states' one-tap responses. */}
      {direction === 'incoming' && request.status === 'pending' ? (
        <View className="mt-3 flex-row gap-2">
          <Button
            title="Lend it"
            variant="secondary"
            loading={busy}
            haptic
            onPress={() => onLend?.(thread)}
            className="flex-1"
          />
          <Button
            title="Not this time"
            variant="ghost"
            disabled={busy}
            onPress={() => onDecline?.(thread)}
            className="flex-1"
          />
        </View>
      ) : null}

      {direction === 'incoming' && request.status === 'approved' ? (
        <Button
          title="Mark returned"
          variant="ghost"
          loading={busy}
          onPress={() => onReturned?.(thread)}
          className="mt-2 self-start"
        />
      ) : null}

      {direction === 'outgoing' && request.status === 'pending' ? (
        <Button
          title="Never mind"
          variant="ghost"
          loading={busy}
          onPress={() => onCancel?.(thread)}
          className="mt-2 self-start"
        />
      ) : null}
    </View>
  );
}
