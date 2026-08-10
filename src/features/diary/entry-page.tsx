import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { BackButton } from '@/components/ui/screen-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import {
  entryDateLine,
  entrySubtitle,
  HISTORY_LINE,
  pieceOrigin,
  pieceStat,
  pieceTitle,
  wearsLine,
} from './entry';
import type { DiaryEntry, DiaryPiece } from './types';

/** The well each piece sits in on the entry page — the atlas's 96pt square. */
const WELL = 96;

export type EntryPageProps = {
  entry: DiaryEntry;
  /** "August 2026" and its total, so the header says where in the record this is. */
  monthLabel: string;
  monthCount: number;
  onBack: () => void;
  resolveImage: (piece: DiaryPiece) => string | undefined;

  onWearAgain: () => void;
  wearingAgain: boolean;

  onKeep: () => void;
  keeping: boolean;

  onEditNote: () => void;

  /**
   * Whether the 24-hour window is still open. The affordance is not hidden
   * when it closes — the rule is printed instead, because a control that
   * silently disappears teaches nobody what the rule was.
   */
  correctable: boolean;
  onRemove: () => void;
  removing: boolean;

  /** A refusal from the server, already turned into a sentence. */
  error: string | null;
};

/**
 * WD-03 — one day, opened.
 *
 * ── Where this departs from atlas 33, and why ─────────────────────────────
 *
 * **Every price is dollars.** The atlas prints "£58 a wear". The app is dollars
 * throughout and reads the figure from `costPerWear`.
 *
 * **A piece with no price gets no cost-per-wear line.** The atlas gives all
 * three pieces one. `items.purchase_price` is nullable and usually null, and
 * an estimate from the category would put a number the user never typed into a
 * sentence that reads as their own accounting. See `pieceStat`.
 *
 * **The correction is here, and the atlas never drew it.** "Editable for a day"
 * is one of the five rules the atlas states in prose, and `unwear_outfit_tx`
 * enforces it in SQL. A rule with no control is a rule nobody can use.
 *
 * **The note is editable.** The atlas draws it as a finished paragraph. It is
 * the only part of an entry that survives the 24-hour window, so it needs a way
 * in — and an entry with no note needs one more, since the note is written on
 * the morning and most mornings nobody writes one.
 */
export function EntryPage(props: EntryPageProps) {
  const { entry } = props;
  const theme = useTheme();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <BackButton onPress={props.onBack} label="Back to the diary" />
        <Text variant="colophon">{props.monthLabel}</Text>
        <View className="ml-auto">
          <Text variant="colophon">{wearsLine(props.monthCount)}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="pb-16">
        <View className="px-gutter pt-2">
          {/* 34px, between the 40px `display` and 28px `title` steps — the
              atlas's own size, moved inline rather than into the scale, on the
              `item/[id].tsx` precedent: one screen's headline is not a token.
              The line height is the serif's own 1.30 box; anything tighter is
              clipped by CoreText. */}
          <Text variant="title" style={{ fontSize: 34, lineHeight: 45 }} accessibilityRole="header">
            {entryDateLine(entry.wornAt)}
          </Text>
          <Text variant="note" className="mt-1.5">
            {entrySubtitle(entry)}
          </Text>
        </View>

        {/* The plate at full size. Wrapped rather than scrolled: a look with
            five pieces is a second line of wells, not a rail that hides one. */}
        <Card padding="lg" className="mx-gutter mt-4">
          {entry.pieces.length > 0 ? (
            <View className="flex-row flex-wrap items-center justify-center gap-3">
              {entry.pieces.map((piece) => (
                <PieceWell
                  key={piece.id}
                  uri={props.resolveImage(piece)}
                  label={pieceTitle(piece)}
                />
              ))}
            </View>
          ) : (
            <Text variant="note">
              The pieces from this day are no longer in your closet. The wear itself stays recorded.
            </Text>
          )}
        </Card>

        {entry.pieces.length > 0 ? (
          <>
            <Text variant="eyebrow" className="px-gutter pb-2.5 pt-6">
              The pieces
            </Text>
            <Card className="mx-gutter">
              {entry.pieces.map((piece, i) => (
                <View key={piece.id}>
                  {i > 0 ? <Rule tone="hairline" /> : null}
                  <PieceRow piece={piece} />
                </View>
              ))}
            </Card>
          </>
        ) : null}

        <NoteCard note={entry.note} onEdit={props.onEditNote} />

        <View className="flex-row flex-wrap gap-2 px-gutter pt-5">
          <Button
            title="Wear this again"
            variant="ink"
            loading={props.wearingAgain}
            disabled={entry.pieces.length === 0}
            onPress={props.onWearAgain}
          />
          <Button
            title={entry.savedAt ? 'Saved as a plate' : 'Save as a plate'}
            variant="secondary"
            loading={props.keeping}
            disabled={entry.savedAt !== null}
            onPress={props.onKeep}
          />
        </View>

        {/* "Editable for a day." The one oxblood action on this screen, and
            quiet text rather than a filled button: it is a correction of the
            reader's own private record, not the thing the page is for. */}
        <View className="px-gutter pt-5">
          {props.correctable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove this entry"
              accessibilityHint="Deletes this wear and puts the pieces' wear counts back"
              accessibilityState={{
                busy: props.removing,
                disabled: props.removing,
              }}
              disabled={props.removing}
              onPress={props.onRemove}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="justify-center active:opacity-60">
              <Text variant="label" style={{ color: theme.accent }}>
                {props.removing ? 'Removing…' : 'Remove this entry'}
              </Text>
            </Pressable>
          ) : (
            <Text variant="note">{HISTORY_LINE}</Text>
          )}

          {props.correctable ? (
            <Text variant="noteSmall" className="mt-0.5">
              Correctable for a day. After that it is history, and only the note can change.
            </Text>
          ) : null}

          {props.error ? (
            <Text variant="label" accessibilityLiveRegion="polite" className="mt-2 text-critical">
              {props.error}
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * Reading one day.
 *
 * The atlas draws no loading frame for the entry — it only draws WD-04 for the
 * spine — so this is the smallest honest thing rather than an invented one: the
 * headline's block, the plate's card and the pieces' card in their real
 * geometry, so nothing moves when the record arrives.
 */
export function EntrySkeleton({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <BackButton onPress={onBack} label="Back to the diary" />
      </View>
      <View className="px-gutter pt-2" accessibilityLabel="Reading this day">
        <Skeleton className="h-8 w-[70%] rounded-chip" />
        <Skeleton className="mt-3 h-3 w-[52%] rounded-chip" delay={120} />
        <Skeleton className="mt-5 h-[132px] w-full rounded-plate" delay={240} />
        <Skeleton className="mt-6 h-[152px] w-full rounded-plate" delay={360} />
      </View>
    </SafeAreaView>
  );
}

/**
 * The day that is not there.
 *
 * Reachable two ways, and it must not accuse either: a stale link from a
 * removed entry, and an entry corrected away in another window. Neither is the
 * reader doing something wrong, so the copy says what happened and offers the
 * record back.
 */
export function EntryMissing({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <BackButton onPress={onBack} label="Back to the diary" />
      </View>
      <View className="flex-1 px-gutter pt-8">
        <Text variant="title">That day isn’t in the record</Text>
        <Text variant="note" className="mt-2">
          It may have been corrected away within its first day. Everything else you wore is still
          there.
        </Text>
        <View className="mt-5 flex-row">
          <Button title="Back to the diary" variant="secondary" onPress={onBack} />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

/** Fitted, never cropped — the same rule as every other well in the app. */
function PieceWell({ uri, label }: { uri: string | undefined; label: string }) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      className="items-center justify-center overflow-hidden rounded bg-tray"
      style={{ width: WELL, height: WELL, padding: 6 }}>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="contain"
          transition={120}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <SymbolView
          name="tshirt"
          size={26}
          tintColor={theme.hairline}
          resizeMode="scaleAspectFit"
        />
      )}
    </View>
  );
}

/** The piece, its colour and maker, and its standing numbers ranged right. */
function PieceRow({ piece }: { piece: DiaryPiece }) {
  const origin = pieceOrigin(piece);

  return (
    <View className="flex-row items-center gap-3.5 px-4 py-3">
      <View className="flex-1">
        <Text variant="body">{pieceTitle(piece)}</Text>
        {origin ? (
          <Text variant="note" className="mt-0.5">
            {origin}
          </Text>
        ) : null}
      </View>
      <Text variant="colophon" className="text-right">
        {pieceStat(piece)}
      </Text>
    </View>
  );
}

/**
 * "Your note", and the way in.
 *
 * An entry with no note is the common case — the note is typed on the morning
 * and most mornings nobody types one — so the card carries the invitation
 * rather than disappearing. `Add` / `Edit` is set in `muted`, not the accent:
 * the screen's one oxblood is already spent on the correction, and a note is
 * not the thing to do here.
 */
function NoteCard({ note, onEdit }: { note: string | null; onEdit: () => void }) {
  const written = note?.trim();

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={written ? 'Edit your note' : 'Add a note'}
      style={{ minHeight: MIN_TAP_TARGET }}
      className="mt-6 active:opacity-60">
      <Card padding="lg" className="mx-gutter">
        <View className="flex-row items-center justify-between">
          <Text variant="eyebrow">Your note</Text>
          <Text variant="label">{written ? 'Edit' : 'Add'}</Text>
        </View>
        <Text variant={written ? 'body' : 'note'} className="mt-2">
          {written ?? 'Nothing written for this day.'}
        </Text>
      </Card>
    </Pressable>
  );
}
