/**
 * Example content — the words, the compositions, and the rules they obey.
 *
 * The correction file's premise, stated once: "An empty Today sells nothing."
 * Six surfaces in this app explain in prose what they will become, and every
 * one of them now shows it instead — a fictional look, week, event, trip or
 * profile, built from the eleven owned garment photographs, labelled on the
 * card, and completely inert.
 *
 * ── WHY THIS FILE HAS NO IMPORTS ──────────────────────────────────────────
 *
 * The interaction rules are testable claims — one accessibility summary per
 * section, a visible in-card label, no fabricated count — and the tests that
 * check them must not drag React Native's Flow source through the node test
 * bundler. Same split, and the same reason, as `camera-copy.ts` and
 * `consent-mode.ts`: the copy is pure, the rendering is next door.
 *
 * ── THE RULES THE RENDERER ENFORCES, RESTATED HERE SO THEY TRAVEL ─────────
 *
 * An example is NOT TOUCHABLE (`pointerEvents: 'none'` on the whole subtree),
 * WRITES NOTHING, SPENDS NO QUOTA (no styling call, no catalogue query, no
 * image processing), and EMITS NO CONTENT ANALYTICS. It never animates as a
 * placeholder — no shimmer, no pulse, no skeleton geometry — because an
 * example is finished content, not a loading state. And the real controls
 * around it stay real: the day strip, the tabs, "New event", "New trip" and
 * every primary button above or below one are fully operable.
 *
 * Dates and weather inside an example are fixed fictional strings. The one
 * exception is the Plan week, whose weekday labels follow the selected week so
 * the example cannot contradict the strip above it.
 */

/** The visible label, inside the card so it survives a screenshot. */
export const EXAMPLE_BADGE = 'Example';

/** The eleven owned photographs, by the names the asset manifest gives them. */
export type GarmentKey =
  | 'beige-corduroy-skirt'
  | 'beige-overshirt-jacket'
  | 'brown-leather-boots'
  | 'brown-leather-crossbody-bag'
  | 'brown-leather-loafers'
  | 'charcoal-tailored-trousers'
  | 'cognac-leather-tote'
  | 'cognac-shearling-coat'
  | 'cream-crochet-poncho'
  | 'cream-mohair-sweater'
  | 'white-linen-blouse';

export const GARMENT_KEYS: readonly GarmentKey[] = [
  'beige-corduroy-skirt',
  'beige-overshirt-jacket',
  'brown-leather-boots',
  'brown-leather-crossbody-bag',
  'brown-leather-loafers',
  'charcoal-tailored-trousers',
  'cognac-leather-tote',
  'cognac-shearling-coat',
  'cream-crochet-poncho',
  'cream-mohair-sweater',
  'white-linen-blouse',
] as const;

/**
 * The accessibility summaries, verbatim from the handoff.
 *
 * One per example section, and the ONLY thing VoiceOver reads there: every
 * descendant image, badge, avatar, date and caption is hidden. Each ends by
 * saying the content is not the reader's own, because a summary that described
 * the picture without saying whose it was would announce fiction as account
 * data.
 */
export const EXAMPLE_SUMMARY = {
  'TE-01':
    'Example outfit. Cream mohair sweater, charcoal trousers, brown loafers. Not your closet.',
  // DEPARTS FROM THE DRAWN STRING, and deliberately. The atlas summary reads
  // "Example outfit built around your pieces", which was true of a frame whose
  // example borrowed the reader's own photographs. It does not, by decision:
  // examples are drawn from the bundled fixture set and never from closet data.
  // Announcing somebody's own pieces inside a card that contains none of them
  // is the one thing an accessibility summary must not do, since it is the only
  // description a VoiceOver reader gets.
  'TE-02': 'Example outfit. Blouse, skirt, boots and bag. Not your closet.',
  'PR-C1': 'Example profile, not a real person. Rae Whitfield, 38 friends, 126 pieces.',
  'PL-C1': 'Example week. Three planned days with outfits. Not your plan.',
  'PL-C2':
    'Example events. Two fictional events with planned outfits and friends looking. Not your events.',
  'PL-C3': 'Example trip. Lisbon, five days, four looks, eleven pieces. Not your trip.',
} as const;

export type ExampleId = keyof typeof EXAMPLE_SUMMARY;

// ── TE-01 / TE-02 · Today ───────────────────────────────────────────────────

/** TE-01 — the empty closet's example look. Three pieces, the plate's own three-up. */
export const TE_01 = {
  name: 'Quiet authority',
  reasoning:
    'Cognac and cream anchor the look while the charcoal trousers ground it. Warm enough for 72°, quiet enough for a Thursday.',
  caption: 'An example outfit, not your closet. Yours will be built from your own pieces.',
  pieces: [
    'cream-mohair-sweater',
    'charcoal-tailored-trousers',
    'brown-leather-loafers',
  ] as GarmentKey[],
} as const;

/** The sentence under TE-01's card — the promise the example is evidence for. */
export const TE_01_PROMISE = 'This is what Cinch gives you back every morning.';

/**
 * TE-02 — the under-floor example. Four pieces, matching the real plate at four.
 *
 * ── IT IS NOT BUILT FROM THE READER'S CLOSET, BY DECISION ─────────────────
 *
 * The atlas draws this example around the reader's own pieces — "the blouse in
 * the example is the same photograph as the blouse in their six" — and the
 * shipped rule is the opposite: examples come from the bundled fixture set and
 * NEVER from closet data. Which is the safer line by some distance. A card
 * labelled "Example" containing a garment somebody actually owns invites
 * exactly one reading — that Cinch made this up about their blouse — and the
 * accessibility summary would then be announcing account data inside a
 * disclaimer. It also keeps the example truly free: nothing is read, resolved
 * or counted from the closet to draw it.
 *
 * So the copy claims nothing about ownership. What separates TE-02 from TE-01
 * is the SHAPE — four pieces against three, matching the real plate at four —
 * and the sentence beside it, which is about the two pieces still missing.
 */
export const TE_02 = {
  name: 'What two more pieces buys you',
  reasoning:
    'A blouse, a skirt, boots and a bag — the kind of look Cinch builds once the floor is met.',
  pieces: [
    'white-linen-blouse',
    'beige-corduroy-skirt',
    'brown-leather-boots',
    'cognac-leather-tote',
  ] as GarmentKey[],
} as const;

/**
 * TE-02's caption.
 *
 * The atlas draws "Two of these pieces are yours; the rest are illustration",
 * which was a sentence about a frame that borrowed the reader's photographs.
 * Nothing on this card is theirs, so it says so and then says what will be —
 * a constant rather than a function, because there is no longer a number to
 * count and a caption that took an argument would invite one back.
 */
export const TE_02_CAPTION =
  'An example, not your closet. Yours will be built from the pieces you have.';

// ── PL-C1 / PL-C2 / PL-C3 · Plan ────────────────────────────────────────────

/**
 * PL-C1 — three planned days, not seven. "A plausible week rather than a demo
 * of completeness."
 *
 * `weekdayIndex` is an offset into the SELECTED week rather than a date: the
 * example's day numbers follow the strip above it, so it can never contradict
 * it. Everything else — the occasion, the weather — is a fixed fictional
 * string, and no forecast call is made for any of it.
 */
export const PL_C1 = {
  title: 'A planned week',
  caption: 'An example week, not your plan.',
  days: [
    {
      weekdayIndex: 0,
      occasion: 'Studio day',
      weather: '64°F, overcast',
      pieces: [
        'white-linen-blouse',
        'charcoal-tailored-trousers',
        'brown-leather-loafers',
      ] as GarmentKey[],
    },
    {
      weekdayIndex: 2,
      occasion: 'Client lunch',
      weather: '58°F, rain by four',
      pieces: [
        'cream-mohair-sweater',
        'beige-corduroy-skirt',
        'brown-leather-boots',
      ] as GarmentKey[],
    },
    {
      weekdayIndex: 5,
      occasion: 'Market, then dinner',
      weather: '49°F, clear',
      pieces: [
        'cognac-shearling-coat',
        'cream-crochet-poncho',
        'brown-leather-crossbody-bag',
      ] as GarmentKey[],
    },
  ],
} as const;

/**
 * PL-C2 — "two events, one crowded and one quiet, so the state does not imply a
 * busy social life is required."
 *
 * The people are monograms in the palette's three darks. No invented faces and
 * no stock portraits: no person photography exists in this project and none can
 * be generated, so a fabricated face would be the one asset here with no
 * provenance at all.
 *
 * The board lines state real product behaviour — looks open before the event
 * and lock at its start — so the example teaches something true.
 */
export const PL_C2 = {
  title: 'Events with looks',
  caption: 'Example events and people. None of these are real.',
  events: [
    {
      name: 'Priya & Tomas’s wedding',
      date: 'Sat 20 Sep',
      where: 'Boulder · 6:00 pm',
      monograms: ['R', 'J', 'M'],
      board: 'Three friends looking · two looks on the board',
      pieces: [
        'white-linen-blouse',
        'beige-corduroy-skirt',
        'cognac-leather-tote',
      ] as GarmentKey[],
    },
    {
      name: 'Autumn gallery opening',
      date: 'Thu 2 Oct',
      where: 'Denver · 7:30 pm',
      monograms: ['D'],
      board: 'One friend looking · board opens a week before',
      pieces: [
        'cream-mohair-sweater',
        'charcoal-tailored-trousers',
        'brown-leather-boots',
      ] as GarmentKey[],
    },
  ],
} as const;

/**
 * PL-C3 — the payoff before the gate, in that order.
 *
 * Two of five days and the piece list, "so the shape of a packed trip is
 * legible without claiming to be complete". The dates are fictional and FIXED —
 * they deliberately do not follow today, so a stale example can never read as
 * an expired trip.
 */
export const PL_C3 = {
  title: 'A packed trip',
  caption: 'An example trip, not yours.',
  place: 'Lisbon',
  dates: '12–16 Oct',
  summary: '5 days · 4 looks · 11 pieces',
  days: [
    {
      label: 'Sun 12',
      occasion: 'Arrival',
      pieces: [
        'white-linen-blouse',
        'beige-corduroy-skirt',
        'brown-leather-loafers',
      ] as GarmentKey[],
    },
    {
      label: 'Tue 14',
      occasion: 'Dinner out',
      pieces: [
        'cream-mohair-sweater',
        'charcoal-tailored-trousers',
        'brown-leather-boots',
      ] as GarmentKey[],
    },
  ],
  piecesToTake: [
    'cognac-shearling-coat',
    'beige-overshirt-jacket',
    'cream-crochet-poncho',
    'brown-leather-crossbody-bag',
    'cognac-leather-tote',
  ] as GarmentKey[],
  piecesToTakeLabel: 'Pieces to take',
} as const;

/**
 * The Pro gate under PL-C3.
 *
 * Names the tier and nothing else. No price, no period, no trial, no renewal —
 * those resolve from StoreKit on the membership sheet the button opens, which
 * is D-5's rule and is why this file must never learn a number.
 */
export const PL_C3_GATE = {
  line: 'Packing is part of Pro. Everything else in Plan stays free.',
  action: 'See what Pro includes',
} as const;

/** The phrases a packing gate may never carry. Asserted in the tests. */
export const GATE_FORBIDDEN = ['$', '£', '€', 'per month', 'per year', 'trial', 'free trial', 'renew'];

// ── PR-C1 / PR-C2 · Profile ─────────────────────────────────────────────────

/**
 * PR-C1 — what friends can see, shown once.
 *
 * "Profile is a private settings sheet. There is no public profile and search
 * reaches existing connections only." So the card says "what your friends see"
 * and the phrase "public profile" appears nowhere — a claim this app cannot
 * honour is the one kind of copy that must never ship on a guess.
 */
export const PR_C1 = {
  badgeSuffix: 'not a real person',
  monogram: 'R',
  name: 'Rae Whitfield',
  handle: '@raewhit',
  bio: 'Denver. Wears the same three coats and is at peace with it.',
  friends: '38 friends',
  pieces: '126 pieces',
  headline: 'This is what your friends see when you swap looks.',
  body: 'Only people you have accepted. Cinch has no public page, and search only finds people already connected to you.',
  accept: 'Start mine',
  dismiss: 'Not now',
  wardrobe: [
    'cognac-shearling-coat',
    'beige-overshirt-jacket',
    'brown-leather-boots',
    'brown-leather-crossbody-bag',
  ] as GarmentKey[],
} as const;

/** PR-C2's quiet line, on the row that fixes the gap it names. */
export const PR_C2_IDENTITY_GAP = 'Add a handle so friends can find you';

/**
 * Where "Start mine" goes — "the smallest honest next step".
 *
 * Edit profile when the identity is incomplete, Add clothes when it is not. It
 * never routes to a share sheet, because there is nothing public to share to.
 *
 * Returns an INTENT, not a path: editing a profile in this app is a sheet on
 * the profile screen (`EditProfileSheet`), not a route, so a function that
 * returned "/profile/edit" would be naming a screen that does not exist. The
 * caller opens the sheet or pushes `/add-clothes`.
 */
export type CoachingDestination = 'edit-profile' | 'add-clothes';

export function coachingDestination(identity: {
  handle?: string | null;
  avatarUrl?: string | null;
}): CoachingDestination {
  const missing = !identity.handle?.trim() || !identity.avatarUrl?.trim();
  return missing ? 'edit-profile' : 'add-clothes';
}

/** The phrase the profile coaching may never carry. Asserted in the tests. */
export const PROFILE_FORBIDDEN = ['public profile', 'public page for you', 'anyone can find'];
