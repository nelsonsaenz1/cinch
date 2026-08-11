import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ClosetFullPanel } from '@/components/wall/closet-full-sheet';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { ordinal } from '@/features/closet/gap-feed';
import { countOutfits, rankGaps, tallyOf } from '@/features/closet/outfit-count';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useGarmentSearchFlow, type GarmentCandidate } from '@/features/ingest/use-garment-search';
import { useWardrobe } from '@/features/styling/queries';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Adding a garment without photographing it — by describing it, or by link.
 *
 * The screen exists because of one number: most people who install a wardrobe
 * app never finish adding their clothes. Photographing forty garments on a
 * hanger is a chore, and the app is useless until it is done. Typing "Reformation
 * midi dress, size 2, navy" is not, and pasting the link to a dress you bought
 * last Tuesday is not even that.
 *
 * ONE FIELD, TWO DOORS. There is no "paste a link" button, because people paste
 * into whatever field is in front of them, and a second control would be a
 * second decision to make before the first is understood. The field reads what
 * it was given: a URL turns the row beneath into the shop's name and the button
 * into "Open this link", and anything else stays a description. Being wrong is
 * cheap and visible — the row says which door it thinks is open, and editing the
 * text changes it back.
 *
 * THE PROMISE THIS SCREEN MAKES IS SMALL ON PURPOSE, in both directions. Search
 * offers found pictures, not certainty — "pictures that might match", each
 * carrying the site it came from. A link offers what the page said about itself,
 * shown as a preview to confirm rather than an item quietly added. Neither
 * writes anything until a person says yes to a specific picture.
 *
 * One oxblood element at a time, as everywhere: the Find button, or — once a
 * link resolves — the Add button on the preview.
 */

const PLACEHOLDER = 'Reformation midi dress, or paste a link…';

/** Mirrors the server's own ceiling, so the field cannot compose a rejection. */
const MAX_DESCRIPTION_CHARS = 240;

/** A pasted product URL is long. Same ceiling the hook and the server use. */
const MAX_LINK_CHARS = 2_048;

/** Mirrors `MAX_TITLE_CHARS` in the function's bounds.ts. */
const MAX_NAME_CHARS = 120;

/**
 * The flow object the body renders from. Named so a fixture can build one by
 * hand: the sheet's whole appearance is a function of this shape, which is what
 * lets the Describe State Atlas pose every state without a network in sight.
 */
export type GarmentSearchFlowView = ReturnType<typeof useGarmentSearchFlow>;

export function GarmentSearchSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const flow = useGarmentSearchFlow();

  // A sheet that reopens holding the last search would be showing results for a
  // garment already added. Clearing on open, not on close, keeps the dismissal
  // animation from playing over a suddenly empty screen.
  useEffect(() => {
    if (visible) flow.reset();
    // Keyed on `visible` alone, deliberately. `reset` closes over the two
    // mutations, whose identity changes on every state transition they make —
    // listing it would clear the results in the same tick they arrive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <GarmentSearchSheetBody flow={flow} onClose={onClose} />
    </Modal>
  );
}

/**
 * Everything inside the modal, taking the flow as a prop rather than owning it.
 *
 * The split is the posable body: the real sheet hands this the live hook, and
 * the dev fixture hands it hand-built flow objects so every state the atlas
 * frames can be put on screen without a search actually running. Nothing else
 * changes — the Modal, the hook, and the reset-on-open stay with the sheet.
 */
export function GarmentSearchSheetBody({
  flow,
  onClose,
}: {
  flow: GarmentSearchFlowView;
  onClose: () => void;
}) {
  const theme = useTheme();
  const router = useRouter();
  const gate = useGate();
  const capacity = useCapacity();
  const wardrobe = useWardrobe();
  const [gatePresenting, setGatePresenting] = useState(false);

  const isLink = flow.link !== null;
  const busy = flow.searching || flow.resolving;
  const canSubmit = isLink ? !busy : flow.description.trim().length >= 3 && !busy;

  // On a successful import the sheet simply gets out of the way. The garment
  // joins the capture queue behind it (see `useGarmentImport`), so what the
  // user drops back onto is the progress rail with their piece on it — not a
  // review deck that cannot see an untagged row yet.
  const choose = async (candidate: GarmentCandidate) => {
    const itemId = await flow.choose(candidate);
    if (itemId) onClose();
  };

  const confirm = async () => {
    const itemId = await flow.confirmPreview();
    if (itemId) onClose();
  };

  const submit = () => {
    if (!canSubmit) return;
    if (isLink) void flow.readLink();
    else void flow.run();
  };

  // The footer caption, and when the sheet has room to say it. It exists only
  // while the lower half is empty — no results, no preview, no error, nothing
  // in flight — because that is the moment a person is deciding, and the moment
  // there is a bottom edge with nothing on it. The describe line names what the
  // swatch is *for*, so attaching one never feels mandatory (and before one is
  // attached, the quiet camera row already says everything — no footer on the
  // bare door). The link line explains why an option that was on screen a
  // moment ago vanished: the colour-photo row's disappearance should read as
  // intent, not a glitch.
  const lowerHalfEmpty =
    flow.results === null && !flow.preview && !flow.errorMessage && !flow.searching && !flow.resolving;
  const footer: 'link' | 'describe' | null = !lowerHalfEmpty
    ? null
    : isLink
      ? 'link'
      : flow.swatch
        ? 'describe'
        : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-start justify-between px-gutter pt-6">
        <View className="flex-1 pr-4">
          <Text variant="title" trim>
            Describe it instead
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          hitSlop={12}
          onPress={onClose}
          className="py-1 active:opacity-60">
          <Text variant="body" className="font-semibold">
            Close
          </Text>
        </Pressable>
      </View>

      {/* With a footer on screen the container grows to fill the sheet, so the
          caption's `marginTop: 'auto'` lands it on the bottom edge — 24px
          clear of it, per the atlas — while short content stays at the top.
          Without one, the paddings are exactly what they always were. */}
      <ScrollView
        contentContainerClassName={footer ? 'grow px-gutter pb-6 pt-4' : 'px-gutter pb-10 pt-4'}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        <Text variant="body" className="text-muted dark:text-muted-dark">
          Say what it is — the brand, the kind of garment, the colour. Or paste the link to it
          from a shop. Cinch finds the picture; you say whether it{'’'}s the right one.
        </Text>

        <View className="mt-5 rounded-plate border border-rule px-4 py-3 dark:border-rule-dark">
          <TextInput
            accessibilityLabel="What is the garment, or a link to it"
            value={flow.description}
            onChangeText={flow.setDescription}
            placeholder={PLACEHOLDER}
            placeholderTextColor={theme.faint}
            // A pasted product URL is far longer than any description. The
            // ceiling follows whichever the field is currently holding, so
            // pasting is never silently truncated mid-URL — which would
            // produce a link that resolves to the wrong page rather than to
            // none, the one failure the user cannot see.
            maxLength={isLink ? MAX_LINK_CHARS : MAX_DESCRIPTION_CHARS}
            multiline
            autoCapitalize={isLink ? 'none' : 'sentences'}
            autoCorrect={!isLink}
            returnKeyType="search"
            submitBehavior="blurAndSubmit"
            onSubmitEditing={submit}
            // The field carries body type like everything else; the colour is
            // inline because NativeWind gives no guaranteed precedence
            // between two text utilities on one element.
            style={{ color: theme.ink, fontSize: 17, minHeight: 66, textAlignVertical: 'top' }}
          />
        </View>

        {/* The recognition line. It appears only when the field holds a URL,
            and it names the shop rather than echoing the link back — the host
            is the part a person can actually check at a glance, and a
            wrapped 200-character tracking URL is noise they cannot read. */}
        {isLink ? (
          <View className="mt-3 flex-row items-center gap-2">
            <SymbolView name="link" size={14} tintColor={theme.muted} resizeMode="scaleAspectFit" />
            <Text variant="label" className="flex-1" numberOfLines={1}>
              Link from {flow.link?.host}
            </Text>
          </View>
        ) : null}

        {/* The colour photo is genuinely optional and reads that way: a quiet
            row, not a second call to action. It exists because "navy" covers
            a dozen navies and a photograph of the actual fabric settles it.
            Hidden on the link path: there is nothing for a colour reference to
            disambiguate when the shop's own photograph is the answer. */}
        {isLink ? null : flow.swatch ? (
          <View className="mt-3 flex-row items-center gap-3">
            <Image
              source={stableImageSource(flow.swatch.uri)}
              contentFit="cover"
              style={{ width: 44, height: 44, borderRadius: 8 }}
              accessibilityIgnoresInvertColors
            />
            <Text variant="label" className="flex-1">
              Colour photo attached
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove colour photo"
              hitSlop={12}
              onPress={flow.clearSwatch}
              className="active:opacity-60">
              <Text variant="label">Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo of the colour"
            onPress={() => void flow.attachSwatch()}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-2 flex-row items-center gap-2 active:opacity-70">
            <SymbolView name="camera" size={15} tintColor={theme.muted} resizeMode="scaleAspectFit" />
            <Text variant="label">Add a photo of the colour</Text>
          </Pressable>
        )}

        {/* One primary at a time. While a preview is on screen the Add button
            inside it is the call to action, so this one steps back to a
            secondary rather than competing with it in oxblood. */}
        <Button
          title={
            flow.resolving
              ? 'Opening'
              : flow.searching
                ? 'Looking'
                : isLink
                  ? 'Open this link'
                  : 'Find it'
          }
          variant={flow.preview ? 'secondary' : 'primary'}
          onPress={submit}
          // Never `loading`: the spinner would eat the label, and the label IS
          // the progress — "Looking" and "Opening" say what is happening in
          // present tense while the dimmed pill holds its place in the layout.
          disabled={!canSubmit}
          haptic
          className="mt-4 self-stretch"
        />

        {/* The closet-full case gets its own W-03 panel instead of the raw
            error line — but only on the LINK path, where there's a held
            preview for the panel to sit under (see the block below). The
            describe/candidate-tile path can hit the same server refusal with
            no preview to hold, and that case keeps the plain error line
            rather than going silent. See closet-full-sheet.tsx's header for
            why this is the bare `ClosetFullPanel` rather than the modal
            `ClosetFullSheet` (this screen is already a modal sheet). */}
        {flow.errorMessage && !(flow.closetFull && flow.preview) ? (
          <Text variant="caption" className="mt-3" style={{ color: theme.critical }}>
            {flow.errorMessage}
          </Text>
        ) : null}

        {flow.preview ? (
          <LinkPreview flow={flow} onConfirm={confirm} />
        ) : (
          <Results flow={flow} onChoose={choose} />
        )}

        {/* The parsed import is held, not cancelled — `flow.preview` above is
            untouched by the failed confirm, so the picture and name stay on
            screen and this panel is simply what replaces the generic error. */}
        {flow.preview && flow.closetFull ? (
          <View className="mt-6 border-t border-rule pt-5">
            <ClosetFullPanel
              eyebrow="Ready to import · closet full"
              title="This is the piece your closet is missing."
              body={(() => {
                const tally = tallyOf(wardrobe.data ?? []);
                const best = rankGaps(tally)[0];
                const today = countOutfits(tally);
                return best && best.gain > 0
                  ? `The right ${ordinal(capacity.limit + 1)} piece could take you from ${today} outfits to ${best.total} — your ${capacity.limit} are already at ${capacity.limit}.`
                  : `Your ${capacity.limit} are already at ${capacity.limit}. Nothing here is lost while you decide.`;
              })()}
              onSeePlans={() => {
                setGatePresenting(true);
                void gate.present(Placement.AddGarmentOverLimit).finally(() => setGatePresenting(false));
              }}
              seePlansBusy={gatePresenting}
              secondaryLabel="Make room for it"
              onSecondary={() => {
                const tally = tallyOf(wardrobe.data ?? []);
                const best = rankGaps(tally)[0]?.kind ?? 'tops';
                onClose();
                router.push(`/wall-swap?add=${best}`);
              }}
            />
            <Text variant="caption" className="mt-3" style={{ color: theme.faint }}>
              The import is held, not cancelled. It’s here when there’s room.
            </Text>
          </View>
        ) : null}

        {/* `faint`, not `muted`, and inline as ever: this line is an aside
            about an affordance already on screen, the one register quiet
            enough for it. The `pt-6` is the floor between it and the button
            when the sheet is short. */}
        {footer === 'describe' ? (
          <Text variant="caption" className="pt-6" style={{ marginTop: 'auto', color: theme.faint }}>
            A photo is optional. {'“'}Navy{'”'} covers a dozen navies; the fabric settles it.
          </Text>
        ) : footer === 'link' ? (
          <Text variant="caption" className="pt-6" style={{ marginTop: 'auto', color: theme.faint }}>
            The colour-photo row is gone: there is nothing for a colour reference to settle when
            the shop{'’'}s own photograph is the answer.
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * What Cinch read off the pasted page, before anything is written.
 *
 * ONE PICTURE AND ONE QUESTION: is this it? Retailer links are shared from
 * apps, carry tracking parameters, and land on category pages as often as
 * product pages, so the answer is shown rather than assumed. Nothing here has
 * touched the closet — declining costs a tap and leaves no row behind.
 *
 * The name is editable because the page's own title is a starting point and not
 * an answer: shops publish "Gemma Dress", "GEMMA DRESS | REFORMATION" and
 * occasionally a URL slug. Pre-filled so the common case is one tap.
 */
function LinkPreview({
  flow,
  onConfirm,
}: {
  flow: GarmentSearchFlowView;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const preview = flow.preview;
  if (!preview) return null;

  return (
    <View className="mt-8">
      <SectionHeader title="What Cinch found" />

      <Card fill="none" className="mt-3">
        {/* Product shots arrive on white with wide margins, so the tray sits
            behind them and `contain` keeps the garment whole. */}
        <View className="aspect-[4/5] w-full bg-tray dark:bg-tray-dark">
          <Image
            source={stableImageSource(preview.imageUrl)}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            accessibilityIgnoresInvertColors
            accessibilityLabel={
              preview.title
                ? `Picture found for ${preview.title}`
                : 'Picture found on the linked page'
            }
          />
        </View>

        <View className="border-t border-rule px-4 py-3 dark:border-rule-dark">
          <TextInput
            accessibilityLabel="Name for this garment"
            value={flow.previewName}
            onChangeText={flow.setPreviewName}
            placeholder="Name this piece"
            placeholderTextColor={theme.faint}
            maxLength={MAX_NAME_CHARS}
            returnKeyType="done"
            style={{ color: theme.ink, fontSize: 17 }}
          />
          {/* The honesty line, same as the candidate tiles carry: this picture
              came from somewhere, and the user gets to judge where. */}
          <Text variant="colophon" numberOfLines={1} className="mt-1">
            {preview.source}
          </Text>
        </View>
      </Card>

      <Button
        title="Add to closet"
        onPress={onConfirm}
        // Demoted off the accent while the closet-full panel is showing below
        // — that panel's "See plans" is the one oxblood action on screen then
        // (rule 9). Re-pressing this still retries the same import; it just
        // isn't the loudest control on the sheet while it's expected to fail.
        variant={flow.closetFull ? 'secondary' : 'primary'}
        loading={flow.importingPreview}
        disabled={flow.importingPreview}
        haptic
        className="mt-4 self-stretch"
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discard this link"
        disabled={flow.importingPreview}
        onPress={flow.discardPreview}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-1 items-center justify-center active:opacity-70">
        <Text variant="label">Not this one</Text>
      </Pressable>

      <Text variant="caption" className="mt-2">
        Cinch saves this picture to your closet and tags the garment for you.
      </Text>
    </View>
  );
}

// Ragged caption widths, so the placeholder grid reads as product titles about
// to arrive rather than a loading graphic.
const TILE_LABEL_WIDTHS = ['72%', '55%', '64%', '48%'] as const;

/**
 * The candidate grid, and the two honest ways it can be empty.
 *
 * `results === null` means no search has run — nothing is said, because there is
 * nothing to say yet. An empty array means the search ran and found nothing
 * usable, which deserves a real sentence and a way forward rather than a shrug.
 * While the search is out, the grid's own shape stands in for it — the tiles
 * the results will land in, not a spinner floating in nothing.
 */
function Results({
  flow,
  onChoose,
}: {
  flow: GarmentSearchFlowView;
  onChoose: (candidate: GarmentCandidate) => void;
}) {
  if (flow.searching) {
    return (
      <View className="mt-8" accessibilityLabel="Looking for pictures">
        <SectionHeader title="Pictures that might match" />
        <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {TILE_LABEL_WIDTHS.map((width, i) => (
            <View key={i} className="mb-4" style={{ width: '50%', paddingHorizontal: 6 }}>
              <Skeleton className="aspect-[4/5] w-full rounded-lg" />
              <Skeleton className="mt-2 h-3 rounded-chip" style={{ width }} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (flow.results === null) return null;

  if (flow.results.length === 0 && !flow.searching) {
    return (
      <View className="mt-8">
        <Text variant="plate">Nothing matched that</Text>
        <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
          Try the brand and the kind of garment — {'“'}Everlane cotton shirt{'”'} finds
          more than {'“'}blue top{'”'}. Photographing it works too, and always finds the
          right one.
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-8">
      <SectionHeader title="Pictures that might match" />

      {/* Two columns, hand-laid rather than a FlatList: six tiles inside a
          ScrollView do not want a second scroll container, and a nested
          VirtualizedList is a warning and a broken gesture. */}
      <View className="mt-3 flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
        {flow.results.map((candidate) => (
          <CandidateTile
            key={candidate.imageUrl}
            candidate={candidate}
            busy={flow.importingUrl === candidate.imageUrl}
            dimmed={flow.importingUrl !== null && flow.importingUrl !== candidate.imageUrl}
            onPress={() => onChoose(candidate)}
          />
        ))}
      </View>

      <Text variant="caption" className="mt-4">
        Tap one to add it. Cinch saves the picture and tags the garment for you.
      </Text>
    </View>
  );
}

function CandidateTile({
  candidate,
  busy,
  dimmed,
  onPress,
}: {
  candidate: GarmentCandidate;
  busy: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add ${candidate.title}, from ${candidate.source}`}
      accessibilityState={{ busy, disabled: dimmed }}
      disabled={dimmed || busy}
      onPress={onPress}
      style={{ width: '50%', paddingHorizontal: 6, opacity: dimmed ? 0.4 : 1 }}
      className="mb-4 active:opacity-80">
      {/* Product shots arrive on white with wide margins, so the tray sits
          behind them and `contain` keeps the garment whole rather than cropping
          a sleeve off to fill a square. */}
      <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray dark:bg-tray-dark">
        <Image
          source={stableImageSource(candidate.imageUrl)}
          contentFit="contain"
          transition={180}
          cachePolicy="memory-disk"
          style={{ flex: 1 }}
          accessibilityIgnoresInvertColors
        />
        {busy ? (
          <View
            className="absolute inset-0 items-center justify-center"
            style={{ backgroundColor: 'rgba(251,250,246,0.72)' }}>
            <ActivityIndicator color={theme.ink} />
          </View>
        ) : null}
      </View>

      <Text variant="caption" numberOfLines={2} className="mt-2" style={{ color: theme.ink }}>
        {candidate.title}
      </Text>
      {/* The source is the honesty line: this picture came from somewhere, and
          the user gets to judge whether that somewhere is the right shop. */}
      <Text variant="colophon" numberOfLines={1}>
        {candidate.source}
      </Text>
    </Pressable>
  );
}
