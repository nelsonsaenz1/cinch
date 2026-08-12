import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { ItemCategory } from '@/schemas/item';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ItemEditDraft = {
  /** The specific word for the garment — writes to `subcategory`. */
  name: string;
  /** Raw text, parsed by the caller. Empty string clears the price. */
  price: string;
  /** The shelf the piece is filed under. */
  category: ItemCategory;
};

export type ItemEditSheetProps = {
  visible: boolean;
  initial: ItemEditDraft;
  onSave: (next: ItemEditDraft) => void;
  onCancel: () => void;
  /** IT-03's foot action. Absent = the piece cannot be stored from here. */
  onStore?: () => void;
  /** The garment, so the correction is made against the thing being corrected. */
  imageUri?: string;
  busy?: boolean;
  /** Set when the last save failed, so the sheet can say so without closing. */
  error?: string | null;
};

/**
 * IT-03 — owner edit, details open.
 *
 * ── "Editing is a separate document with its own bar" ─────────────────────
 *
 * This used to be a bottom sheet floating over the dimmed item page, with a
 * serif title and two stacked buttons at its foot. The frame makes it a
 * document: full height, its own Cancel / Edit piece / Save bar at the top, and
 * the page it came from is gone rather than dimmed behind it — "so the hero
 * never becomes a form".
 *
 * "Field labels are the only Medium text besides Save; every value and every
 * explanation is regular." That is the constitution's weight rule stated for
 * this frame, and it is why the values in the tray wells are `body` and the
 * uppercase labels above them are the only `label`s on the screen.
 *
 * "Store sits alone under a rule at the foot, in oxblood text but not as a
 * filled action, because it is consequential but reversible — and the word
 * delete does not appear on this screen at all." Both halves are literal: the
 * control is text, and there is no delete anywhere below.
 *
 * ── TWO FIELDS THE FRAME DRAWS AND THIS DOES NOT ──────────────────────────
 *
 * BOUGHT. `items.purchase_date` is a real column and is read on the item page,
 * but nothing in this app has ever written it: there is no date-entry control
 * anywhere in the codebase, and adding one means a new dependency, which this
 * lane may not take. A tray well that looked like a field and could not be
 * typed into is a dead control, and the standing rule is that a dead control
 * never ships. So the field is absent and the dependency is recorded, rather
 * than drawn dead or faked with free text a `date` column cannot store.
 *
 * NOTES, ONLY YOU SEE THESE. There is no private-notes column. The nearest
 * thing is `items.description`, which the tagger writes garment detail into and
 * which a FRIEND'S closet view already reads (`features/social-graph/types.ts`
 * maps it onto the friend-facing item). Labelling that field "only you see
 * these" would be a privacy claim this app cannot honour, which is the one kind
 * of copy that must never ship on a guess.
 *
 * Both omissions lose nothing: the purchase date still prints in the attribute
 * sentence on the item page, and no note has ever been enterable here.
 */

/** IT-03's chips, in the frame's own words for the shelves. */
const CATEGORY_CHOICES: { key: ItemCategory; label: string }[] = [
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'dress', label: 'Dresses' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'bag', label: 'Bags' },
  { key: 'accessory', label: 'Accessories' },
  { key: 'headwear', label: 'Headwear' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'other', label: 'Other' },
];

/** The frame's tray well: r12, 48pt, 17px value. */
const FIELD_HEIGHT = 48;

export function ItemEditSheet({
  visible,
  initial,
  onSave,
  onCancel,
  onStore,
  imageUri,
  busy = false,
  error = null,
}: ItemEditSheetProps) {
  const theme = useTheme();

  const [draft, setDraft] = useState<ItemEditDraft>(initial);

  /**
   * Re-seed from the row every time the sheet OPENS, and only then.
   *
   * Adjusted during render rather than in an effect — React's own "adjusting
   * state when a prop changes" pattern. An effect would set state after a
   * committed paint, which is both a cascading render and a visible frame of
   * the previous item's values; it also trips `react-hooks/set-state-in-effect`.
   *
   * The trigger is `visible`, deliberately NOT `initial`: `initial` is a fresh
   * object literal on every render of the page, so keying on it would reset the
   * field under the user's cursor — and this screen re-renders on every
   * keystroke of the price field.
   */
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(initial);
  }

  // NOTE: the spring that used to run on this sheet's own translate is gone
  // with the sheet. A document is presented by the platform; a card rising over
  // a page had to animate itself, and there is no page under this one now.

  const photo = stableImageSource(imageUri);

  return (
    <Modal
      visible={visible}
      // Not `transparent`: a document is presented, not floated. `slide` is the
      // system's own presentation for a modally pushed form.
      animationType="slide"
      onRequestClose={busy ? undefined : onCancel}
      presentationStyle="pageSheet">
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        {/* The bar. Cancel is regular at the frame's secondary colour, the
            title is Medium, and Save is the ONE oxblood on the screen — text,
            because a filled accent bar button would outweigh the document. */}
        <View className="flex-row items-center justify-between px-gutter pt-2">
          <BarAction label="Cancel" color={theme.muted} disabled={busy} onPress={onCancel} />
          <Text variant="body" className="font-semibold text-ink" style={{ fontSize: 16 }}>
            Edit piece
          </Text>
          <BarAction
            label="Save"
            color={theme.accent}
            medium
            disabled={busy}
            busy={busy}
            onPress={() => onSave(draft)}
          />
        </View>

        <ScrollView
          contentContainerClassName="px-gutter pt-2 pb-8"
          keyboardShouldPersistTaps="handled"
          // The price field is the last one before the foot; the decimal pad
          // covers the bottom of the screen and this is UIScrollView's own
          // answer to that.
          automaticallyAdjustKeyboardInsets>
          {/* The garment, and the one thing a person editing is most likely to
              be worried about. Both are the frame's. */}
          <View className="flex-row items-center gap-3.5">
            <View
              className="overflow-hidden rounded-md bg-tray"
              style={{ width: 96, height: 116 }}>
              {photo ? (
                <Image
                  source={photo}
                  contentFit="cover"
                  transition={180}
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
            </View>
            <Text variant="note" className="flex-1" style={{ fontSize: 14, lineHeight: 21 }}>
              The photograph stays as it is. Replacing it does not lose the wear history filed
              against this piece.
            </Text>
          </View>

          <Field label="Name">
            <TextInput
              value={draft.name}
              onChangeText={(name) => setDraft((d) => ({ ...d, name }))}
              placeholder="Untitled piece"
              // IT-03 sets every value and every explanation in the regular
              // cut at the frame's secondary colour; `faint` is refused as
              // text anywhere, and a field's placeholder is text.
              placeholderTextColor={theme.muted}
              accessibilityLabel="Piece name"
              returnKeyType="done"
              editable={!busy}
              className="flex-1 font-body"
              style={{ minHeight: FIELD_HEIGHT, fontSize: 17, color: theme.ink }}
            />
          </Field>

          <View className="mt-4">
            <FieldLabel>Category</FieldLabel>
            {/* Chips, not a picker: a correction is one tap in this app. r12,
                and the held one takes INK — the oxblood on this frame is spent
                on Save alone. */}
            <View className="mt-2 flex-row flex-wrap gap-2">
              {CATEGORY_CHOICES.map((c) => (
                <Chip
                  key={c.key}
                  label={c.label}
                  size="tap"
                  selected={draft.category === c.key}
                  selectedGround="ink"
                  onPress={() => setDraft((d) => ({ ...d, category: c.key }))}
                />
              ))}
            </View>
          </View>

          <Field label="What you paid">
            <Text variant="body" className="text-muted" style={{ fontSize: 17 }}>
              $
            </Text>
            <TextInput
              value={draft.price}
              onChangeText={(price) => setDraft((d) => ({ ...d, price }))}
              keyboardType="decimal-pad"
              inputMode="decimal"
              placeholder="0"
              placeholderTextColor={theme.muted}
              accessibilityLabel="Price paid, in dollars"
              returnKeyType="done"
              editable={!busy}
              className="ml-1 flex-1 font-body"
              style={{ minHeight: FIELD_HEIGHT, fontSize: 17, color: theme.ink }}
            />
          </Field>

          {error ? (
            <Text
              variant="note"
              accessibilityLiveRegion="polite"
              className="pt-3 text-critical">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {/* "Store sits alone under a rule at the foot, in oxblood TEXT but not
            as a filled action." Absent entirely when the caller has nowhere to
            store to, rather than drawn inert. */}
        {onStore ? (
          <View className="border-t border-hairline px-gutter pb-4 pt-3.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Store this piece"
              accessibilityHint="Moves it out of your active closet. It keeps its photograph, wears and price, and you can bring it back."
              disabled={busy}
              onPress={onStore}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="items-center justify-center active:opacity-60">
              {/* Regular weight: Medium is reserved for labels and filled
                  actions, and this is neither. */}
              <Text variant="body" style={{ fontSize: 15, color: theme.accent }}>
                Store this piece
              </Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

/** One of the bar's two text actions, at the 44pt floor. */
function BarAction({
  label,
  color,
  medium = false,
  disabled,
  busy = false,
  onPress,
}: {
  label: string;
  color: string;
  /** Save is Medium; Cancel is regular. The frame's own distinction. */
  medium?: boolean;
  disabled: boolean;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
      className="active:opacity-60">
      <Text
        variant="body"
        className={medium ? 'font-semibold' : undefined}
        style={{ fontSize: 16, color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The tracked uppercase field label — the only Medium text besides Save. */
function FieldLabel({ children }: { children: string }) {
  return (
    <Text variant="label" style={{ fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}

/** A labelled tray well — the label above, the r12 48pt field below. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mt-4">
      <FieldLabel>{label}</FieldLabel>
      <View
        className="mt-2 flex-row items-center rounded-md bg-tray px-3.5"
        style={{ minHeight: FIELD_HEIGHT }}>
        {children}
      </View>
    </View>
  );
}
