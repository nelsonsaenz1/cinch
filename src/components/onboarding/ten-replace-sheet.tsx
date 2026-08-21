import { Image } from 'expo-image';
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { replaceSheetCopy } from '@/features/onboarding/ten-copy';
import { useTheme } from '@/theme/tokens';

/**
 * LP-02's focused review — the sheet a filled First 10 tile opens.
 *
 * Split body/modal for the reason `ten-stop-sheet.tsx` is: a fixture route can
 * photograph the card flat without driving a presentation layer.
 *
 * FOUR ACTIONS, IN ONE ORDER, and the order is the accepted correction to the
 * atlas rather than a preference. Retake and Choose from library are the two
 * answers to "this photograph is wrong", which is why the tile was tapped;
 * `Edit details` is the push to `/item/{id}` that tapping a filled tile has
 * always done, kept third so nobody loses the path they already had; Cancel is
 * last and closes without touching anything.
 *
 * ONE CONDITIONAL GUEST between Edit details and Cancel: the look-alike offer
 * ("Find a cleaner photo"), drawn only when the piece's just-settled upload
 * job derived eligible. It is a ghost row like the two around it — a quiet
 * offer about the photograph, not a fifth peer — and when the job says
 * nothing, the sheet is exactly the four actions it has always been.
 *
 * DYNAMIC TYPE. Nothing here is a fixed-height text container and nothing is
 * clipped to one line — the title takes two if the piece has a long name at
 * AX5, the plate grows, and the four actions keep their own minimum heights.
 * The preview is the only fixed box, and it is a picture rather than type.
 */
export function TenReplaceSheetBody({
  slotId,
  garmentName,
  imageUri,
  onRetake,
  onLibrary,
  onEditDetails,
  onFindPhoto,
  onCancel,
}: {
  slotId: number;
  /** The classifier's word for the piece, or null while it is still being read. */
  garmentName?: string | null;
  imageUri?: string;
  onRetake: () => void;
  onLibrary: () => void;
  /** Opens `/item/{garmentId}`. Mutates NOTHING — not the slot, not the count. */
  onEditDetails: () => void;
  /**
   * The look-alike offer — opens the existing match flow for this piece, where
   * a shop's own shot can be attached ALONGSIDE the photograph (never in place
   * of it). Present only when the piece's settled upload job derived eligible
   * (`match-eligibility.ts`); absent, the row is simply not drawn, because a
   * quiet offer that cannot be honoured is a button built to disappoint.
   * Mutates nothing here — the sheet on the far side runs only when asked.
   */
  onFindPhoto?: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const copy = replaceSheetCopy(slotId, garmentName ?? null);

  return (
    <View
      className="rounded-t-sheet border-t border-rule bg-surface"
      style={{ paddingHorizontal: 22, paddingTop: 22 }}
      accessibilityViewIsModal>
      <View
        style={{
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: theme.rule,
          alignSelf: 'center',
          marginBottom: 18,
        }}
      />

      <View className="flex-row items-center" style={{ gap: 14 }}>
        {/* The piece the reader tapped, so the sheet is unambiguously about
            THIS photograph and not the grid in general. Decorative: everything
            it says is said in type beside it, and a second announcement of the
            same garment would only lengthen the VoiceOver pass. */}
        <View
          className="overflow-hidden bg-tray"
          style={{ width: 72, height: 88, borderRadius: 12, borderWidth: 1, borderColor: theme.rule }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>

        {/* `flex-1` plus no `numberOfLines`: a long subcategory at AX5 wraps
            rather than truncating, which is LP-09's rule for any text needed to
            know what you are about to replace. */}
        <View className="flex-1" style={{ gap: 2 }}>
          <Text variant="eyebrow">{copy.eyebrow}</Text>
          <Text variant="title" trim accessibilityRole="header" style={{ fontSize: 26 }}>
            {copy.title}
          </Text>
        </View>
      </View>

      <Text variant="note" className="mt-3.5" style={{ fontSize: 15, lineHeight: 22 }}>
        {copy.body}
      </Text>

      <View style={{ marginTop: 18, gap: 4, paddingBottom: 20 }}>
        <Button
          title={copy.retake}
          onPress={onRetake}
          haptic
          className="self-stretch"
          accessibilityLabel={`${copy.retake}, slot ${slotId}`}
        />
        <Button
          title={copy.library}
          variant="secondary"
          onPress={onLibrary}
          className="self-stretch"
          accessibilityLabel={`${copy.library}, slot ${slotId}`}
        />
        <Button
          title={copy.edit}
          variant="ghost"
          onPress={onEditDetails}
          className="self-stretch"
          accessibilityLabel={`${copy.edit}, slot ${slotId}`}
        />
        {onFindPhoto ? (
          <Button
            title={copy.findPhoto}
            variant="ghost"
            onPress={onFindPhoto}
            className="self-stretch"
            accessibilityLabel={`${copy.findPhoto}, slot ${slotId}`}
            accessibilityHint="Opens the listing-photo search for this piece. Your photograph stays."
          />
        ) : null}
        <Button title={copy.cancel} variant="ghost" onPress={onCancel} className="self-stretch" />
      </View>
    </View>
  );
}

export function TenReplaceSheet({
  visible,
  slotId,
  garmentName,
  imageUri,
  onRetake,
  onLibrary,
  onEditDetails,
  onFindPhoto,
  onCancel,
}: {
  visible: boolean;
  slotId: number;
  garmentName?: string | null;
  imageUri?: string;
  onRetake: () => void;
  onLibrary: () => void;
  onEditDetails: () => void;
  onFindPhoto?: () => void;
  onCancel: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 justify-end" style={{ backgroundColor: theme.scrim }}>
        <SafeAreaView edges={['bottom']}>
          <TenReplaceSheetBody
            slotId={slotId}
            garmentName={garmentName}
            imageUri={imageUri}
            onRetake={onRetake}
            onLibrary={onLibrary}
            onEditDetails={onEditDetails}
            onFindPhoto={onFindPhoto}
            onCancel={onCancel}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}
