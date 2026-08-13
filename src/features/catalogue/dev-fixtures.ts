/**
 * The fourteen CPV2 states, posed from the REAL feed.
 *
 * The families below are the licensed Datafeedr response for James Perse,
 * recorded from production on 2026-08-13 and grouped by the shipping server
 * rules — the same rows as `tests/fixtures/catalogue-james-perse.json`, which
 * is where their provenance is written down. Titles, colour names and merchant
 * hosts are verbatim; only the image URLs are stand-ins, because a repo fixture
 * may not carry merchant affiliate links and the atlas's own §5 says every
 * product image in it is a marked stand-in for the same reason.
 *
 * That choice matters for what Codex can and cannot judge from these routes.
 * GEOMETRY, COPY, STATE AND ACCESSIBILITY are all real here. IMAGE QUALITY is
 * not — §5 of the handoff says "Real Datafeedr imagery is required before the
 * visual quality of CPV2-04/05/06/08 can be judged", and that is still true.
 *
 * Every callback in every pose is inert. A fixture route must not be able to
 * spend a metered request or write a row, and the only way to be sure of that
 * is for the poses to contain no live function at all.
 */

import type { CatalogueColourway, CatalogueFamily } from './types';
import type { CatalogueFlowView } from './use-catalogue-flow';

const HOST = 'mrporter.com';

function colour(
  id: string,
  label: string,
  opts: { resolved?: boolean; noImage?: boolean } = {},
): CatalogueColourway {
  return {
    label,
    resolved: opts.resolved ?? true,
    imageUrl: opts.noImage ? null : `https://img.${HOST}/${id}.jpg`,
    alternateImageUrl: null,
    externalId: id,
    sourceHost: HOST,
    pageUrl: `https://${HOST}/p/${id}`,
  };
}

/** The launch family: seven colourways of one shirt, one merchant. */
export const COMBED: CatalogueFamily = {
  familyId: 'fam-combed',
  brand: 'James Perse',
  title: 'Combed Cotton-Jersey T-Shirt',
  productClass: 'top',
  category: null,
  gender: null,
  merchants: [HOST],
  nearMissCut: null,
  colours: [
    colour('1639900306641083100', 'Black'),
    colour('1639900451691798000', 'Blue'),
    colour('1639903894340818000', 'Grey'),
    colour('1639904163926963500', 'Green'),
    colour('1639904653657043500', 'Brown'),
    // "Neutrals" is Mr Porter's own word and the lexicon cannot place it. §10.3:
    // the row says so rather than inventing a name.
    colour('1639908127512818400', 'Neutrals', { resolved: false }),
    colour('1639909694322988800', 'White', { noImage: true }),
  ],
};

export const LOTUS: CatalogueFamily = {
  familyId: 'fam-lotus',
  brand: 'James Perse',
  title: 'Lotus Slim-Fit Cotton-Jersey T-Shirt',
  productClass: 'top',
  category: null,
  gender: null,
  merchants: [HOST],
  nearMissCut: null,
  colours: [
    colour('1639902902407654400', 'Black'),
    colour('1639906438382463000', 'White'),
    colour('1639906697518071600', 'Blue'),
  ],
};

export const LUXE: CatalogueFamily = {
  familyId: 'fam-luxe',
  brand: 'James Perse',
  title: 'Luxe Cotton-Jersey T-Shirt',
  productClass: 'top',
  category: null,
  gender: null,
  merchants: [HOST],
  nearMissCut: null,
  colours: [colour('1639902557653029000', 'Grey'), colour('1639903236235044400', 'Black')],
};

/**
 * A Grailed resale listing, kept because it is what the feed really returns.
 *
 * Its title is a keyword dump, so `presentedTitle` prints "Catalogue name
 * unavailable" over it — which is the state §10.3 asks for and the one most
 * worth looking at, because it is the one that would otherwise ship as junk.
 */
export const UNNAMEABLE: CatalogueFamily = {
  familyId: 'fam-grailed',
  brand: 'James Perse',
  title: 'T-Shirt Mens 1XL Gray Cotton Casual Usa Made Logo Classic Preppy Short Sleeve',
  productClass: 'top',
  category: null,
  gender: null,
  merchants: ['grailed.com'],
  nearMissCut: null,
  colours: [
    {
      label: 'Grey',
      resolved: true,
      imageUrl: 'https://img.grailed.com/1558298748867622700.jpg',
      alternateImageUrl: null,
      externalId: '1558298748867622700',
      sourceHost: 'grailed.com',
      pageUrl: 'https://grailed.com/p/1558298748867622700',
    },
  ],
};

export const HENLEY: CatalogueFamily = {
  familyId: 'fam-henley',
  brand: 'James Perse',
  title: 'Henley T Shirt In Grey Striped Cashmere Blend',
  productClass: 'top',
  category: null,
  gender: null,
  merchants: ['grailed.com'],
  nearMissCut: 'henley',
  colours: [
    {
      label: 'Grey',
      resolved: true,
      imageUrl: 'https://img.grailed.com/1558290908514136300.jpg',
      alternateImageUrl: null,
      externalId: '1558290908514136300',
      sourceHost: 'grailed.com',
      pageUrl: 'https://grailed.com/p/1558290908514136300',
    },
  ],
};

export const LONG_SLEEVE: CatalogueFamily = {
  familyId: 'fam-longsleeve',
  brand: 'James Perse',
  title: "Men's Long-Sleeve Crew Neck T-Shirt",
  productClass: 'top',
  category: null,
  gender: null,
  merchants: ['coutr.com'],
  nearMissCut: 'long sleeve',
  colours: [
    {
      label: 'Nero',
      resolved: false,
      imageUrl: 'https://img.coutr.com/1615921186070070800.jpg',
      alternateImageUrl: null,
      externalId: '1615921186070070800',
      sourceHost: 'coutr.com',
      pageUrl: 'https://coutr.com/p/1615921186070070800',
    },
  ],
};

export const FAMILIES = {
  exact: [COMBED, LOTUS, LUXE, UNNAMEABLE],
  nearMiss: [HENLEY, LONG_SLEEVE],
};

const QUERY = { text: "James Perse men's T-shirt", path: 'typed' as const, namedColours: [] };

/** Nothing here does anything. See the header. */
const INERT: CatalogueFlowView = {
  step: 'search',
  text: QUERY.text,
  setText: () => {},
  canSearch: true,
  submit: () => {},
  editSearch: () => {},
  search: { status: 'idle' },
  family: null,
  openFamily: () => {},
  closeFamily: () => {},
  selected: [],
  toggleColour: () => {},
  selectedColours: [],
  review: () => {},
  backToDetail: () => {},
  confirm: () => {},
  importing: false,
  results: [],
  refusal: null,
  retryFailed: () => {},
  errorMessage: null,
  addedItemIds: [],
  reset: () => {},
  // CPV2-11's hold. Null in every pose but the one that draws it — a fixture
  // must not read AsyncStorage, and an offer nobody made would be a fourth
  // thing on screen in thirteen frames that do not have one.
  heldSelection: null,
  restoreHeld: () => {},
  dismissHeld: () => {},
};

export function pose(over: Partial<CatalogueFlowView>): CatalogueFlowView {
  return { ...INERT, ...over };
}

const THREE = COMBED.colours.slice(0, 3);

/** Every frame, by its atlas name. The dev routes read from here. */
export const CPV2_POSES = {
  /** CPV2-01 — idle typed search, mic a peer in the field. */
  '01-idle': pose({ text: '', canSearch: false }),
  /** CPV2-02 — listening. The disclosure is the screen's own; the flow is idle. */
  '02-listening': pose({ text: '', canSearch: false }),
  /** CPV2-03 — transcript in the field, search in flight. */
  '03-transcript': pose({ search: { status: 'searching', query: QUERY } }),
  /** CPV2-04 — four exact families, two subordinate near-misses. */
  '04-families': pose({ search: { status: 'results', query: QUERY, families: FAMILIES } }),
  /** CPV2-05 — family detail, two of seven colourways selected. */
  '05-detail': pose({
    step: 'detail',
    family: COMBED,
    selected: THREE.slice(0, 2).map((c) => c.externalId),
    selectedColours: THREE.slice(0, 2),
    search: { status: 'results', query: QUERY, families: FAMILIES },
  }),
  /** CPV2-06 — confirmation, three closet-ready previews. */
  '06-confirm': pose({
    step: 'confirm',
    family: COMBED,
    selected: THREE.map((c) => c.externalId),
    selectedColours: THREE,
  }),
  /** CPV2-07 — per-colour import, one image failed, retry offered. */
  '07-importing': pose({
    step: 'importing',
    family: COMBED,
    selected: THREE.map((c) => c.externalId),
    selectedColours: THREE,
    results: [
      { externalId: THREE[0].externalId, status: 'added', itemId: 'item-1' },
      { externalId: THREE[1].externalId, status: 'failed', error: 'image_unreachable' },
      { externalId: THREE[2].externalId, status: 'already-added', itemId: 'item-3' },
    ],
  }),
  /** CPV2-08 — success, three pieces, the family sentence. */
  '08-success': pose({
    step: 'done',
    family: COMBED,
    selectedColours: THREE,
    results: [
      { externalId: THREE[0].externalId, status: 'added', itemId: 'item-1' },
      { externalId: THREE[1].externalId, status: 'added', itemId: 'item-2' },
      { externalId: THREE[2].externalId, status: 'added', itemId: 'item-3' },
    ],
    addedItemIds: ['item-1', 'item-2', 'item-3'],
  }),
  /** CPV2-09 — not in the catalogue, four peer exits. */
  '09-no-match': pose({ search: { status: 'empty', query: QUERY } }),
  /** CPV2-10 — the four failure notices. This pose is `offline`; the route
   *  renders all four so they can be compared side by side. */
  '10-offline': pose({
    search: { status: 'failed', query: QUERY, failure: 'offline', code: 'offline' },
  }),
  '10-timeout': pose({
    search: { status: 'failed', query: QUERY, failure: 'timeout', code: 'search_timeout' },
  }),
  '10-quota': pose({
    search: { status: 'failed', query: QUERY, failure: 'quota', code: 'ai_quota_exceeded' },
  }),
  '10-partner': pose({
    search: {
      status: 'failed',
      query: QUERY,
      failure: 'partner_unavailable',
      code: 'catalogue_unavailable',
    },
  }),
  /** CPV2-11 — shelf full after acquisition; the selection is held. */
  '11-capacity': pose({
    step: 'confirm',
    family: COMBED,
    selected: THREE.map((c) => c.externalId),
    selectedColours: THREE,
    refusal: { code: 'closet_limit_reached', requested: 3, active: 8, activeLimit: 10 },
  }),
  /**
   * CPV2-11 again, a day later: the closet has room now and the selection is
   * offered back rather than silently re-ticked.
   */
  '11-held': pose({
    heldSelection: { family: COMBED, colours: [...THREE] },
  }),
  /** CPV2-12 — 375 pt at AX5. Same data as CPV2-05; the route passes `large`. */
  '12-ax5': pose({
    step: 'detail',
    family: COMBED,
    selected: THREE.map((c) => c.externalId),
    selectedColours: THREE,
  }),
} as const;

export type CPV2PoseName = keyof typeof CPV2_POSES;

/** Every pose name, for the route-coverage test to walk. */
export const CPV2_POSE_NAMES = Object.keys(CPV2_POSES) as CPV2PoseName[];
