import type { Item } from '@/schemas/item';

/**
 * Development fixtures for the closet grid.
 *
 * Deliberately has NO image paths. Real cutouts require Apple Vision subject
 * lifting, which does not run in the iOS Simulator and needs a physical device
 * — so the simulator will always render the no-cutout fallback. That makes this
 * the honest default to design against, and it doubles as coverage for the
 * `pending_upload` / `pending_tag` / `needs_review` states, which real users
 * genuinely hit mid-import.
 *
 * The mix below is intentional: enough formality spread to exercise the
 * multi-event logic later, one never-worn item for the cost-per-wear edge case,
 * and one failed-tagging item for the review path.
 */

function make(partial: Partial<Item> & Pick<Item, 'id' | 'category' | 'subcategory'>): Item {
  return {
    userId: 'fixture-user',
    imagePath: null,
    cutoutPath: null,
    thumbPath: null,
    status: 'verified',
    colors: [],
    pattern: null,
    material: null,
    brand: null,
    formalityScore: 3,
    warmthScore: 3,
    waterResistant: false,
    seasons: [],
    occasions: [],
    description: null,
    purchasePrice: null,
    purchaseDate: null,
    wearCount: 0,
    lastWornAt: null,
    isArchived: false,
    isForSale: false,
    userVerified: true,
    createdAt: new Date(0).toISOString(),
    ...partial,
  };
}

export const fixtureItems: Item[] = [
  make({
    id: '00000000-0000-4000-8000-000000000001',
    category: 'outerwear',
    subcategory: 'Overshirt',
    colors: [{ hex: '#3E4A3D', name: 'olive' }],
    material: 'cotton twill',
    brand: 'Uniqlo',
    formalityScore: 3,
    warmthScore: 3,
    seasons: ['spring', 'fall'],
    occasions: ['casual', 'date'],
    description: 'Boxy olive overshirt that works as a light layer or a jacket.',
    purchasePrice: 69.9,
    wearCount: 23,
    lastWornAt: new Date(Date.now() - 2 * 864e5).toISOString(),
  }),
  make({
    id: '00000000-0000-4000-8000-000000000002',
    category: 'bottom',
    subcategory: 'Straight jeans',
    colors: [{ hex: '#22304A', name: 'indigo' }],
    material: 'denim',
    formalityScore: 2,
    warmthScore: 3,
    seasons: ['spring', 'fall', 'winter'],
    occasions: ['casual', 'streetwear'],
    description: 'Dark indigo straight-leg jeans, rigid denim.',
    purchasePrice: 128,
    wearCount: 64,
    lastWornAt: new Date(Date.now() - 864e5).toISOString(),
  }),
  make({
    id: '00000000-0000-4000-8000-000000000003',
    category: 'footwear',
    subcategory: 'Loafers',
    colors: [{ hex: '#5B3A29', name: 'chestnut' }],
    material: 'leather',
    formalityScore: 4,
    warmthScore: 2,
    seasons: ['spring', 'summer', 'fall'],
    occasions: ['office', 'date', 'event'],
    description: 'Chestnut leather penny loafers, leather sole.',
    purchasePrice: 245,
    // Never worn — exercises the cost-per-wear null path.
    wearCount: 0,
  }),
  make({
    id: '00000000-0000-4000-8000-000000000004',
    category: 'top',
    subcategory: 'Merino crewneck',
    colors: [{ hex: '#1C1C1C', name: 'black' }],
    material: 'merino wool',
    formalityScore: 4,
    warmthScore: 4,
    seasons: ['fall', 'winter'],
    occasions: ['office', 'date', 'event'],
    description: 'Fine-gauge black merino crewneck that dresses up or down.',
    purchasePrice: 110,
    wearCount: 31,
    lastWornAt: new Date(Date.now() - 5 * 864e5).toISOString(),
  }),
  make({
    id: '00000000-0000-4000-8000-000000000005',
    category: 'outerwear',
    subcategory: 'Rain shell',
    colors: [{ hex: '#2A2A2E', name: 'charcoal' }],
    material: 'nylon',
    waterResistant: true,
    formalityScore: 2,
    warmthScore: 2,
    seasons: ['spring', 'fall'],
    occasions: ['casual', 'outdoor'],
    description: 'Packable charcoal rain shell, taped seams.',
    purchasePrice: 185,
    wearCount: 12,
  }),
  make({
    id: '00000000-0000-4000-8000-000000000006',
    category: 'other',
    subcategory: null,
    // Tagging failed for this one. Surfaces first in the review deck.
    status: 'needs_review',
    userVerified: false,
    formalityScore: null,
    warmthScore: null,
    description: null,
  }),
];
