import { useLocalSearchParams } from 'expo-router';
import { Asset } from 'expo-asset';
import { Fragment, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MessageBubble } from '@/components/stylist/message-bubble';
import {
  AnswerGrid,
  Composer,
  OPENING_TOP,
  OpeningSkeleton,
  StepFooter,
  StylistHeader,
  StylistOpening,
  TRANSCRIPT_TOP,
} from '@/components/stylist/sheet-parts';
import { ClosetDidntLoad, ClosetTooSmall } from '@/components/stylist/stylist-states';
import { Chip } from '@/components/ui/chip';
import { KeyboardAvoidingScreen } from '@/components/ui/keyboard-aware-scroll-view';
import { Text } from '@/components/ui/text';
import { greeting } from '@/features/stylist/opening';
import { DOORS } from '@/features/stylist/stylist-spec';
import { buildSteps, type Step } from '@/features/stylist/questionnaire';
import type { ChatMessage } from '@/features/stylist/use-chat';
import { toGarmentColors } from '@/lib/color';
import type { FeatureVector, Garment, OutfitCandidate, WeatherContext } from '@/lib/styling';

/**
 * Stylist state fixture — `cinch://dev-stylist`.
 *
 * A picker over all ten frames of the Stylist State Atlas (S-01…S-10), so the
 * sheet can be verified state by state on a simulator. The real screen is
 * unreachable there: it needs a signed-in session, a closet of at least ten
 * tagged pieces, a forecast, and — for half the states — a specific server
 * failure. Waiting for a quota refusal to happen naturally is not a review
 * process.
 *
 * TWO RULES MAKE THIS WORTH TRUSTING.
 *
 * First, every state is drawn by the SAME components the real screen uses:
 * `MessageBubble` for every turn, `ClosetTooSmall`/`ClosetDidntLoad` for S-09
 * and S-10, `Chip` for the refinements, and — for the sheet's own furniture —
 * the parts in `src/components/stylist/sheet-parts.tsx`: `StylistHeader`,
 * `StylistOpening`, `OpeningSkeleton`, `AnswerGrid`, `StepFooter` and
 * `Composer`. There is not one hand copy left in this file, and that is the
 * whole point: those parts used to be private to `src/app/stylist.tsx` and
 * duplicated down here under a comment asking the next person to keep the two
 * in step, which failed twice — the second time leaving this fixture previewing
 * a pre-alignment version of the screen a reviewer was signing off on.
 * Importing them means what a reviewer looks at here IS what ships, by
 * construction rather than by anyone's discipline. If a frame needs a part to
 * behave differently, it gets a prop in `sheet-parts.tsx`; nothing gets
 * re-drawn here.
 *
 * Second, nothing here touches a session. No `useWardrobe`, no `useChat`, no
 * `useQuestionnaire`, no Supabase — the screen renders signed-out or it is
 * useless. The two pure functions it does call, `greeting()` and
 * `buildSteps()`, take everything they need as arguments, so S-01's line and
 * S-02/S-03's questions are the real ones rather than transcribed copies.
 *
 * Copy is the atlas's, verbatim, including its curly apostrophes: the refusal
 * strings, the transport-failure string, "Looking through your closet…", the
 * outfit captions and the follow-up. If a string here and a string in
 * `use-chat.ts` disagree, that is a finding, not a fixture bug.
 *
 * Dev-only, like every other `dev-` route: the auth gate in `app/_layout.tsx`
 * bounces the whole prefix outside `__DEV__`, and this file refuses a second
 * time below in case the route is ever reached another way.
 */

// ---------------------------------------------------------------------------
// Fixture garments
// ---------------------------------------------------------------------------

// The same licensed photographs the atlas draws S-05 with, from the set
// documented in assets/garments/MANIFEST.md — resolved to local URIs the way
// dev-item.tsx does, because `MessageBubble` wants the `string` a signed URL
// would be, not the module number `require` returns.
const COAT = Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri;
const KNIT = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const LOAFERS = Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri;
const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const SKIRT = Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri;
const TOTE = Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri;

/**
 * One fixture garment.
 *
 * Colours go through the engine's own `toGarmentColors` rather than being
 * hand-built, so `family`, `neutrality` and `weight` are whatever the real
 * pipeline would have derived — and so the colour fill the strip falls back to
 * is the fill a real garment of this colour would get. The hex is passed
 * explicitly because two of the atlas's colour words ("chalk", "oat") are not
 * in the named-colour table and would resolve to nothing.
 *
 * `path` is a stand-in for a Supabase storage path: the strip asks
 * `resolveImage` for it, and FIXTURE_IMAGES below answers with a bundled asset.
 * That keeps the resolver doing the job the real `useSignedUrls` does — mapping
 * a stored path to something displayable — instead of the fixture reaching
 * around it.
 */
function fixtureGarment(g: {
  id: string;
  slot: Garment['slot'];
  category: Garment['category'];
  subcategory: string;
  colorName: string;
  hex: string;
  /** The strip's flex weights, read off the atlas's own 3 / 2 / 2 / 1 strips. */
  visualWeight: number;
  path: string | null;
}): Garment {
  return {
    id: g.id,
    slot: g.slot,
    category: g.category,
    subcategory: g.subcategory,
    colors: toGarmentColors([{ hex: g.hex, name: g.colorName }]),
    visualWeight: g.visualWeight,
    fit: 'regular',
    pattern: null,
    patternScale: 'none',
    material: null,
    brand: null,
    formality: 3,
    warmth: 3,
    waterResistant: false,
    seasons: ['autumn'],
    occasions: ['date'],
    wearCount: 0,
    lastWornAt: null,
    purchasePrice: null,
    // Only the cutout is populated. The strip asks for `cutoutPath` first and
    // `thumbPath` second, so leaving the thumb null exercises the same
    // first-match-wins resolution the real screen runs.
    thumbPath: null,
    cutoutPath: g.path,
    platePath: null,
  };
}

/** S-05's first strip: "cognac shearling coat, cream mohair sweater, …". */
const WARM_OUTFIT_ITEMS: Garment[] = [
  fixtureGarment({ id: 'coat', slot: 'outerwear', category: 'outerwear', subcategory: 'shearling coat', colorName: 'cognac', hex: '#8E5525', visualWeight: 3, path: 'fixture/cognac-shearling-coat' }),
  fixtureGarment({ id: 'knit', slot: 'base_top', category: 'top', subcategory: 'mohair sweater', colorName: 'cream', hex: '#EFE6D2', visualWeight: 2, path: 'fixture/cream-mohair-sweater' }),
  fixtureGarment({ id: 'trousers', slot: 'bottom', category: 'bottom', subcategory: 'trousers', colorName: 'charcoal', hex: '#36393D', visualWeight: 2, path: 'fixture/charcoal-tailored-trousers' }),
  fixtureGarment({ id: 'loafers', slot: 'footwear', category: 'footwear', subcategory: 'loafers', colorName: 'brown', hex: '#6B4A34', visualWeight: 1, path: 'fixture/brown-leather-loafers' }),
];

/** S-05's second strip: "chalk linen blouse, oat corduroy skirt, …". */
const LIGHT_OUTFIT_ITEMS: Garment[] = [
  fixtureGarment({ id: 'blouse', slot: 'base_top', category: 'top', subcategory: 'linen blouse', colorName: 'chalk', hex: '#E6E0D4', visualWeight: 2, path: 'fixture/white-linen-blouse' }),
  fixtureGarment({ id: 'skirt', slot: 'bottom', category: 'bottom', subcategory: 'corduroy skirt', colorName: 'oat', hex: '#D9C9A8', visualWeight: 2, path: 'fixture/beige-corduroy-skirt' }),
  fixtureGarment({ id: 'loafers-2', slot: 'footwear', category: 'footwear', subcategory: 'loafers', colorName: 'brown', hex: '#6B4A34', visualWeight: 1, path: 'fixture/brown-leather-loafers' }),
  fixtureGarment({ id: 'tote', slot: 'bag', category: 'bag', subcategory: 'tote', colorName: 'cognac', hex: '#8E5525', visualWeight: 1, path: 'fixture/cognac-leather-tote' }),
];

const FIXTURE_IMAGES: Record<string, string> = {
 'fixture/cognac-shearling-coat': COAT,
 'fixture/cream-mohair-sweater': KNIT,
 'fixture/charcoal-tailored-trousers': TROUSERS,
 'fixture/brown-leather-loafers': LOAFERS,
 'fixture/white-linen-blouse': BLOUSE,
 'fixture/beige-corduroy-skirt': SKIRT,
 'fixture/cognac-leather-tote': TOTE,
};

/**
 * `MessageBubble` reads nothing off a candidate but `items`. The rest of the
 * shape is filled with plausible middles rather than zeroes so nobody reading
 * this later mistakes a fixture default for a scoring claim.
 */
const NEUTRAL_FEATURES: FeatureVector = {
  palette: 0.8, formality: 0.8, weather: 0.8, occasion: 0.8, proportion: 0.8,
  pattern: 0.8, season: 0.8, freshness: 0.8, affinity: 0.8,
};

const outfit = (items: Garment[]): OutfitCandidate => ({
  items,
  features: NEUTRAL_FEATURES,
  score: 0.87,
  notes: {},
  harmonies: [],
});

// ---------------------------------------------------------------------------
// Fixture context
// ---------------------------------------------------------------------------

/**
 * The atlas's own forecast: rain likely, 54°F. Both numbers are load-bearing —
 * `weatherAside` only speaks at a precipitation chance of 0.5 or more, which is
 * what puts "Rain is likely — 54° out." in front of S-01's line, and 12.2°C is
 * what `formatTemp` rounds to 54°F for S-03's weather question.
 */
const FIXTURE_WEATHER: WeatherContext = {
  feelsLikeC: 12.2,
  highC: 15,
  lowC: 9,
  precipitationChance: 0.6,
  windKph: 11,
  swing: false,
};

/** "54°", as `formatTemp(12.2, 'F')` would produce it for the weather step. */
const FIXTURE_TEMPERATURE = '54°';

/**
 * Wednesday 6 August, 7pm — the day the atlas frames are dated, at the hour
 * that makes `greeting()` return "Evening". The line rotates on the day of the
 * month (6 % 3 = 0), so this exact date is what yields the atlas's "Going out,
 * or staying in?" rather than one of the slot's other two readings.
 */
const FIXTURE_NOW = new Date(2026, 7, 6, 19, 0, 0);

/**
 * A closet, only ever passed to `buildSteps`.
 *
 * It exists for one reason: the silhouette step is skipped unless the closet
 * holds a dress, and the atlas's S-03 asks it. There is no dress photograph in
 * the licensed set (see the MANIFEST's open gap), but the step only needs the
 * slot to exist — the garment is never drawn.
 */
const FIXTURE_WARDROBE: Garment[] = [
  ...WARM_OUTFIT_ITEMS,
  ...LIGHT_OUTFIT_ITEMS,
  fixtureGarment({ id: 'dress', slot: 'dress', category: 'dress', subcategory: 'slip dress', colorName: 'burgundy', hex: '#5C2233', visualWeight: 3, path: null }),
];

/**
 * The real script, built by the real builder — not a transcription of it.
 *
 * `buildSteps` is pure: closet in, questions out, no session anywhere near it.
 * Calling it means S-02 and S-03 show whatever the shipping questionnaire would
 * actually ask, so a wording change in `questionnaire.ts` shows up here without
 * anyone remembering to update a fixture. With a dress in the closet and a
 * forecast on hand it returns four steps, which is the "1 of 4" the atlas draws.
 *
 * The forecast and its formatted temperature are passed together because
 * `QuestionnaireContext` now pairs them in a union: a forecast with no reading
 * to name is not a state the weather step could be asked in, so it is not a
 * state the type admits. Both are non-null here — the arm that asks all four.
 */
const FIXTURE_STEPS: Step[] = buildSteps('dressed', {
  wardrobe: FIXTURE_WARDROBE,
  weather: FIXTURE_WEATHER,
  temperature: FIXTURE_TEMPERATURE,
});

/** S-03's answered turns, in the atlas's own words. */
const FIXTURE_TRANSCRIPT = [
  { key: 'occasion', question: 'What is the day asking for?', answer: 'Dinner out' },
  { key: 'silhouette', question: 'Dress, or trousers?', answer: 'Either’s fine' },
  { key: 'mood', question: 'And the mood?', answer: 'Dark and romantic' },
];

// ---------------------------------------------------------------------------
// Fixture messages
// ---------------------------------------------------------------------------

const turn = (
  id: string,
  role: ChatMessage['role'],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage => ({ id, role, text, outfits: [], followUp: null, ...extra });

/** The sentence `composeAsk` folds S-03's four taps into, shown as the person's own. */
const COMPOSED_ASK = 'I’m going out for dinner. I want something dark and romantic.';

const S04_MESSAGES: ChatMessage[] = [
  turn('u1', 'user', COMPOSED_ASK),
  turn('a1', 'assistant', '', { pending: true }),
];

const S05_MESSAGES: ChatMessage[] = [
  turn('u1', 'user', COMPOSED_ASK),
  turn(
 'a1',
 'assistant',
 'Two ways to go. The shearling over the mohair is the warmer one, and the rain won’t bother it.',
    {
      outfits: [outfit(WARM_OUTFIT_ITEMS), outfit(LIGHT_OUTFIT_ITEMS)],
      followUp: 'Want me to push it dressier?',
    },
  ),
];

const S06_MESSAGES: ChatMessage[] = [
  turn('u1', 'user', 'What do I pack for Rome in July?'),
  turn(
 'a1',
 'assistant',
 'The stylist could not be reached. Your outfits on the Today tab still work — they are built on your phone.',
    { failed: true, retryable: true },
  ),
];

/**
 * S-07's three refusals, each with the atlas's own label above it.
 *
 * The atlas draws these as a labelled panel rather than a phone frame, because
 * the point of the frame is the contrast between them: all three are `failed`
 * and none is `retryable`, so none may show "Try again" — a retry would refuse
 * identically and, for the plan and quota cases, would burn the one moment an
 * upgrade makes sense. `onRetry` is still handed to every bubble below, so what
 * a reviewer sees is the component's own guard holding rather than the fixture
 * declining to offer the callback.
 */
const S07_REFUSALS: { label: string; message: ChatMessage }[] = [
  {
    label: 'Consent not granted',
    message: turn(
 'r1',
 'assistant',
 'Cinch needs your permission to use AI before it can answer. You can turn it on from the Add clothes screen.',
      { failed: true, retryable: false },
    ),
  },
  {
    label: 'Plan excludes the stylist',
    message: turn('r2', 'assistant', 'The stylist is part of Standard and Pro.', {
      failed: true,
      retryable: false,
    }),
  },
  {
    label: 'Monthly messages used',
    message: turn('r3', 'assistant', 'You have used this month’s stylist messages.', {
      failed: true,
      retryable: false,
    }),
  },
];

// ---------------------------------------------------------------------------
// The states
// ---------------------------------------------------------------------------

const STATES = [
  { id: 'S-01', title: 'Opening — the four doors' },
  { id: 'S-02', title: 'Question 1 of 4 — no Back yet' },
  { id: 'S-03', title: 'Mid-flow — transcript, Back, weather step' },
  { id: 'S-04', title: 'Composed — one request, pending' },
  { id: 'S-05', title: 'Answered — outfit strips' },
  { id: 'S-06', title: 'Failed turn — retryable' },
  { id: 'S-07', title: 'The three refusals — not outages' },
  { id: 'S-08', title: 'Reading your wardrobe' },
  { id: 'S-09', title: 'Closet too small to style' },
  { id: 'S-10', title: 'Closet didn’t load — not an empty closet' },
] as const;

type StateId = (typeof STATES)[number]['id'];

// ---------------------------------------------------------------------------
// The little that is still drawn here
// ---------------------------------------------------------------------------

/*
 * `OPENING_TOP` / `TRANSCRIPT_TOP` and the refinement row were the last two
 * things stated in both this file and `stylist.tsx`. Both now come from
 * `sheet-parts.tsx`, on the remedy this file's own note prescribed: export them
 * and have both call sites read them. Nothing presentational is written twice
 * any more.
 */

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export default function DevStylistScreen() {
  // ── DEEP-LINKABLE — `cinch:///dev-stylist?state=S-05` ────────────────────
  //
  // `simctl` opens URLs and cannot tap, so a picker-driven fixture can be
  // looked at by hand and never photographed. The URL is the source of truth
  // and a tap is an override the URL clears — expo-router does not remount a
  // screen when only the query string changes, so seeding `useState` once
  // would ignore every link after the first.
  const params = useLocalSearchParams<{ state?: string }>();
  const linked = (STATES as readonly { id: string }[]).some((s) => s.id === params.state)
    ? (params.state as StateId)
    : 'S-01';
  const [state, setState] = useState<StateId>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setState(linked);
  }
  /**
   * Photographs or colour fills.
   *
   * Both are shipping paths. A strip whose signed URLs have not landed yet — or
   * whose garment was never cut out — draws each piece as its own colour, and
   * that frame is as real as the one with photographs in it and is otherwise
   * impossible to summon on demand. Defaults to photographs, which is what the
   * atlas draws S-05 with.
   */
  const [photos, setPhotos] = useState(true);
  const scrollRef = useRef<ScrollView>(null);
  /**
   * The composer's draft, held here because the shared `Composer` is controlled
   * — the real screen holds it for the same reason, so it can clear the field on
   * send. Nothing in this fixture reads it: typing repaints the send button's
   * two fills, which is the only way to review them here, and no `onSend` is
   * passed, so the armed button posts nowhere.
   */
  const [draft, setDraft] = useState('');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  /**
   * Stands in for `useSignedUrls`' `resolve`: same first-match-wins contract,
   * same `undefined` when nothing resolves, backed by bundled assets instead of
   * a Supabase signing round trip.
   */
  const resolveImage = (...paths: (string | null | undefined)[]): string | undefined => {
    if (!photos) return undefined;
    for (const path of paths) {
      if (path && FIXTURE_IMAGES[path]) return FIXTURE_IMAGES[path];
    }
    return undefined;
  };

  const hello = greeting({ now: FIXTURE_NOW, weather: FIXTURE_WEATHER, units: 'F' });
  const firstStep = FIXTURE_STEPS[0];
  const lastStep = FIXTURE_STEPS[FIXTURE_STEPS.length - 1];

  /** True for the frames the atlas draws with a composer under them. */
  const hasComposer = state !== 'S-08' && state !== 'S-09' && state !== 'S-10';
  /**
   * "New question" is reachable only once there is a thread to leave, which is
   * the condition the real header is given — so it appears from S-04 on, and
   * S-07's refusals count as a thread because they are turns in one.
   */
  const hasThread = state === 'S-04' || state === 'S-05' || state === 'S-06' || state === 'S-07';
  const selected = STATES.find((s) => s.id === state)!;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      {/* The picker. Scaffolding, not a designed surface — plain on purpose, so
          nothing about it can be mistaken for part of the state below it. */}
      <View className="border-b border-rule pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-2 px-gutter py-2">
          {STATES.map((s) => (
            <Chip
              key={s.id}
              label={s.id}
              selected={state === s.id}
              selectedGround="ink"
              onPress={() => setState(s.id)}
            />
          ))}
        </ScrollView>
        <View className="flex-row items-center justify-between gap-3 px-gutter">
          <Text variant="caption" className="flex-1">
            {selected.id} · {selected.title}
          </Text>
          <Chip
            label={photos ? 'Photos' : 'Colour fills'}
            selected={photos}
            selectedGround="ink"
            onPress={() => setPhotos((p) => !p)}
          />
        </View>
      </View>

      <KeyboardAvoidingScreen className="flex-1">
        <StylistHeader onNewQuestion={hasThread ? () => {} : undefined} />

        {state === 'S-09' ? <ClosetTooSmall onAddClothes={() => {}} /> : null}
        {state === 'S-10' ? <ClosetDidntLoad onRetry={() => {}} /> : null}

        {/* S-08's bars are the opening composition in its own places —
            salutation, subline, four doors — so nothing moves when the real
            thing lands. `OpeningSkeleton` owns its own 26pt top offset, here as
            on the screen: the loading branch is never a scroll container's
            child, so there is nothing for that offset to double up against. */}
        {state === 'S-08' ? <OpeningSkeleton /> : null}

        {hasComposer ? (
          <ScrollView
            ref={scrollRef}
            className="flex-1"
            contentContainerClassName="pb-4"
            // One padding for every frame in here, chosen the way the screen
            // chooses it: 16 under the opening, 20 under a transcript. It lives
            // on the content container rather than inside a branch so the two
            // can never add up, and it merges with the `pb-4` class above rather
            // than replacing it, because they set different edges.
            contentContainerStyle={{ paddingTop: state === 'S-01' ? OPENING_TOP : TRANSCRIPT_TOP }}
            keyboardShouldPersistTaps="handled"
            // The real screen scrolls to the newest turn as content grows, and
            // both S-03 and S-05 are annotated "shown scrolled to the latest
            // turn". Without this the reviewer opens a long frame at the top,
            // which is not the frame the atlas drew.
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}>
            {/* The whole opening composition, closing caption and all, from the
                real `greeting()` pinned to the atlas's own evening. No
 `onStart`: the four doors press and dim and open nothing, which
                is what keeps this a frame to look at rather than a flow to
                walk. */}
            {state === 'S-01' ? (
              <StylistOpening
                salutation={hello.salutation}
                line={hello.line}
                starts={DOORS}
              />
            ) : null}

            {state === 'S-02' && firstStep ? (
              <View>
                {/* `flush`, on the question being answered right now. The atlas
                    puts 12 between it and its answers, which is `AnswerGrid`'s
                    own offset; this bubble's 16pt bottom margin would stack on
                    top of that — React Native does not collapse margins — and
                    draw 28. No margin at this call site either: `StepFooter`
                    owns the atlas's 18 above itself. */}
                <MessageBubble
                  message={turn('q-1', 'assistant', firstStep.question)}
                  resolveImage={resolveImage}
                  flush
                />
                <AnswerGrid options={firstStep.options} />
                <StepFooter position={1} total={FIXTURE_STEPS.length} canGoBack={false} />
              </View>
            ) : null}

            {state === 'S-03' && lastStep ? (
              <View>
                {/* Answered steps, replayed through the same bubble the model's
                    turns use — the atlas's point about S-03 is that a scripted
                    turn and a model one are indistinguishable, which is only
                    demonstrated if the fixture uses the same component too. */}
                {FIXTURE_TRANSCRIPT.map((t) => (
                  <Fragment key={t.key}>
                    <MessageBubble
                      message={turn(`q-${t.key}`, 'assistant', t.question)}
                      resolveImage={resolveImage}
                    />
                    <MessageBubble
                      message={turn(`a-${t.key}`, 'user', t.answer)}
                      resolveImage={resolveImage}
                    />
                  </Fragment>
                ))}

                {/* `flush` here and deliberately NOT on the replayed pairs
                    above: their 16/18 rhythm is the transcript's own, and it is
                    what makes a scripted pair read like a model turn. Only the
                    live question hands its gap to `AnswerGrid`. */}
                <MessageBubble
                  message={turn('q-current', 'assistant', lastStep.question)}
                  resolveImage={resolveImage}
                  flush
                />
                <AnswerGrid options={lastStep.options} />
                {/* `canGoBack` with no `onBack`: S-03's frame draws **Back**,
                    and pressing it does nothing. The gating prop decides whether
                    the affordance exists, the callback decides whether it acts,
                    which is exactly why the two are separate props. `onType` is
                    absent for the always-drawn version of the same rule. */}
                <StepFooter
                  position={FIXTURE_STEPS.length}
                  total={FIXTURE_STEPS.length}
                  canGoBack
                />
              </View>
            ) : null}

            {state === 'S-04' || state === 'S-05' || state === 'S-06' ? (
              <View>
                {(state === 'S-04' ? S04_MESSAGES : state === 'S-05' ? S05_MESSAGES : S06_MESSAGES).map(
                  (message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      resolveImage={resolveImage}
                      onPressOutfit={() => {}}
                      onRetry={() => {}}
                    />
                  ),
                )}
              </View>
            ) : null}

            {state === 'S-07' ? (
              <View>
                {S07_REFUSALS.map(({ label, message }) => (
                  <Fragment key={message.id}>
                    {/* The atlas's own panel labels. Three refusals stacked in
                        one thread is not a situation the app can produce, so
                        without them a reviewer cannot tell which bubble is
                        which — and which one is which is the entire frame. */}
                    <Text variant="eyebrow" className="mb-3 px-gutter">
                      {label}
                    </Text>
                    <MessageBubble
                      message={message}
                      resolveImage={resolveImage}
                      onRetry={() => {}}
                    />
                  </Fragment>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {/* No `onSend`: the field takes text and the send button repaints, and
            nothing is posted anywhere. That is the shared `Composer`'s own
            behaviour for an absent callback rather than a fixture-only variant
            of it — which matters, because those two fills are one of the things
            a reviewer is here to look at. */}
        {hasComposer ? <Composer value={draft} onChangeText={setDraft} /> : null}
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}
