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
  correctionWindowLine,
  entryDateLine,
  entrySubtitle,
  entryWeatherLine,
  HISTORY_LINE,
  lookCostPerWear,
  pieceOrigin,
  pieceStat,
  pieceTitle,
  provenanceLine,
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

  /**
   * The clock the 24-hour countdown is read against.
   *
   * Injected rather than read inside the component so a fixture route can
   * freeze it: WD-02 prints "14 hours left", and a frame whose figure changes
   * every hour cannot be signed off or compared against itself.
   */
  now?: Date;

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
 *
 * ── Wave 3, WD-02: what was added, and the one thing that was not ─────────
 *
 * Added: the three ruled facts (weather that day, cost for the look, where it
 * came from) and the 24-hour rule stated with its remaining figure. All four
 * are read off columns that already exist — `context_snapshot`,
 * `purchase_price`, `origin_outfit_id` / `generated_by`, and `worn_at`.
 *
 * **"Change pieces" IS NOT DRAWN.** WD-02 gives the undo a peer that swaps the
 * garments in a recorded wear. Nothing in the database can honour it: the
 * commands are `wear_outfit_tx` (insert a fresh wear, increment every piece)
 * and `unwear_outfit_tx` (delete the row, decrement every piece), and there is
 * no update path for `outfit_items` on a worn outfit at all — no command, no
 * policy exercised by one, no client mutation. Composing it out of an undo and
 * a re-wear would move `worn_at` to now, restart the 24-hour window, and write
 * a second row into a record whose whole contract is that a wear is an event.
 * A dead control is worse than an absent one, so it is absent, and the
 * dependency is recorded: a `change_wear_items_tx` command, or an explicit
 * ruling that a wear is immutable and the atlas's peer action is retired.
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

        {/* WD-02's three ruled facts, under the composed grid. Each of them is
            a fact the reader could otherwise only guess at, and each is
            PRINTED WHEN KNOWN AND ABSENT WHEN NOT — there is no dash and no
            estimate in this block. */}
        <FactRows entry={entry} />

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

        {/* WD-02: the rule stated as a rule AND as a remaining figure, so undo
            is never a surprise. The rule comes FIRST — the reader meets the
            window before the control that spends it.

            "Change pieces", which the atlas draws as this action's peer, is
            ABSENT. See the docblock at the head of this file. */}
        <View className="px-gutter pt-6">
          <Text variant="note">
            {props.correctable
              ? correctionWindowLine(entry.wornAt, props.now ?? new Date())
              : HISTORY_LINE}
          </Text>

          {props.correctable ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Undo this wear"
              accessibilityHint="Deletes this wear and puts the pieces' wear counts back"
              accessibilityState={{
                busy: props.removing,
                disabled: props.removing,
              }}
              disabled={props.removing}
              onPress={props.onRemove}
              hitSlop={8}
              style={{ minHeight: MIN_TAP_TARGET }}
              className="mt-1 justify-center active:opacity-60">
              {/* The screen's one oxblood, and quiet text rather than a filled
                  button: this is a correction of the reader's own private
                  record, not the thing the page is for. */}
              <Text variant="label" style={{ color: theme.accent }}>
                {props.removing ? 'Undoing…' : 'Undo this wear'}
              </Text>
            </Pressable>
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

/**
 * WD-02's three ruled facts — weather, cost, provenance.
 *
 * A row appears only when its fact is known. The weather row is the one that
 * is most often absent (`wear_outfit_tx` takes the context from the client and
 * two call sites pass null), and the cost row drops the moment one piece in
 * the look has no price. Neither prints a dash, an estimate, or "unknown":
 * the section simply has two rows instead of three, and the reader is never
 * shown a number nobody typed.
 *
 * Provenance is always known, so it is always drawn — which is what makes the
 * section a section rather than an occasional card.
 */
function FactRows({ entry }: { entry: DiaryEntry }) {
  const weather = entryWeatherLine(entry.weather);
  const cost = lookCostPerWear(entry);

  const rows: { label: string; value: string }[] = [];
  if (weather) rows.push({ label: 'Weather that day', value: weather });
  if (cost !== null) rows.push({ label: 'Cost for the look', value: `$${cost.toFixed(2)} a wear` });
  rows.push({ label: 'Where it came from', value: provenanceLine(entry) });

  return (
    <View className="mt-6 px-gutter">
      {rows.map((row, i) => (
        <View key={row.label}>
          {i > 0 ? <Rule tone="hairline" /> : null}
          <View className="flex-row items-baseline justify-between gap-4 py-3">
            <Text variant="note">{row.label}</Text>
            <Text variant="body" className="shrink text-right">
              {row.value}
            </Text>
          </View>
        </View>
      ))}
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
