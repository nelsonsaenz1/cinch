import type { OutfitCandidate, StyleContext } from '@/lib/styling';

export type OutfitNameTag =
  | 'casual' | 'polished' | 'formal' | 'warm' | 'light' | 'layered' | 'rain'
  | 'neutral' | 'tonal' | 'contrast' | 'colour' | 'balanced' | 'relaxed'
  | 'clean' | 'dress' | 'separates' | 'outerwear' | 'accessorized'
  | 'pattern' | 'texture' | 'quiet';

export type OutfitNameEntry = Readonly<{ name: string; tags: readonly OutfitNameTag[] }>;

/** Curated names are the sole vocabulary for local and enhanced naming. */
export const OUTFIT_NAME_LIBRARY: readonly OutfitNameEntry[] = [
  { name: 'Easy Alignment', tags: ['casual', 'balanced'] },
  { name: 'Off Duty Edit', tags: ['casual', 'clean'] },
  { name: 'Everyday Rhythm', tags: ['casual', 'separates'] },
  { name: 'Relaxed Register', tags: ['casual', 'relaxed'] },
  { name: 'Simple Interval', tags: ['casual', 'quiet'] },
  { name: 'Clean Departure', tags: ['casual', 'clean'] },
  { name: 'Quietly Put Together', tags: ['polished', 'quiet'] },
  { name: 'Considered Ease', tags: ['polished', 'casual'] },
  { name: 'Soft Structure', tags: ['polished', 'balanced'] },
  { name: 'Measured Line', tags: ['polished', 'clean'] },
  { name: 'Sharp Enough', tags: ['polished', 'casual'] },
  { name: 'Finished Without Fuss', tags: ['polished', 'quiet'] },
  { name: 'After Hours Line', tags: ['formal', 'clean'] },
  { name: 'Evening Standard', tags: ['formal', 'polished'] },
  { name: 'Dressed in Balance', tags: ['formal', 'balanced'] },
  { name: 'The Formal Edit', tags: ['formal', 'clean'] },
  { name: 'Warm Composition', tags: ['warm', 'layered'] },
  { name: 'Cold Day Layers', tags: ['warm', 'layered'] },
  { name: 'Held in Layers', tags: ['warm', 'outerwear'] },
  { name: 'Covered Ground', tags: ['warm', 'outerwear'] },
  { name: 'Light on Purpose', tags: ['light', 'clean'] },
  { name: 'Warm Weather Edit', tags: ['light', 'casual'] },
  { name: 'Air Between Pieces', tags: ['light', 'relaxed'] },
  { name: 'The Light Line', tags: ['light', 'separates'] },
  { name: 'Layered Logic', tags: ['layered', 'balanced'] },
  { name: 'One More Layer', tags: ['layered', 'outerwear'] },
  { name: 'Built in Layers', tags: ['layered', 'texture'] },
  { name: 'Rain Ready Edit', tags: ['rain', 'outerwear'] },
  { name: 'Weather Considered', tags: ['rain', 'polished'] },
  { name: 'Neutral Territory', tags: ['neutral', 'quiet'] },
  { name: 'Quiet Palette', tags: ['neutral', 'clean'] },
  { name: 'Soft Neutrals', tags: ['neutral', 'tonal'] },
  { name: 'Tonal Agreement', tags: ['tonal', 'polished'] },
  { name: 'One Colour Story', tags: ['tonal', 'colour'] },
  { name: 'Close in Tone', tags: ['tonal', 'quiet'] },
  { name: 'Clear Contrast', tags: ['contrast', 'clean'] },
  { name: 'Contrast in Check', tags: ['contrast', 'balanced'] },
  { name: 'Opposites Aligned', tags: ['contrast', 'polished'] },
  { name: 'Colour in Context', tags: ['colour', 'balanced'] },
  { name: 'A Colour Note', tags: ['colour', 'accessorized'] },
  { name: 'Palette With Purpose', tags: ['colour', 'polished'] },
  { name: 'Balanced Volume', tags: ['balanced', 'separates'] },
  { name: 'Proportion in Place', tags: ['balanced', 'clean'] },
  { name: 'Easy Proportions', tags: ['balanced', 'relaxed'] },
  { name: 'Room to Move', tags: ['relaxed', 'casual'] },
  { name: 'Relaxed and Resolved', tags: ['relaxed', 'polished'] },
  { name: 'Clean Lines Only', tags: ['clean', 'quiet'] },
  { name: 'The Clean Cut', tags: ['clean', 'polished'] },
  { name: 'Single Line Dressing', tags: ['dress', 'clean'] },
  { name: 'Dress First', tags: ['dress', 'polished'] },
  { name: 'One Piece Answer', tags: ['dress', 'quiet'] },
  { name: 'Separates in Sync', tags: ['separates', 'balanced'] },
  { name: 'The Separate Edit', tags: ['separates', 'polished'] },
  { name: 'Outer Layer First', tags: ['outerwear', 'layered'] },
  { name: 'Framed by Outerwear', tags: ['outerwear', 'polished'] },
  { name: 'The Finishing Piece', tags: ['accessorized', 'polished'] },
  { name: 'Small Detail Energy', tags: ['accessorized', 'colour'] },
  { name: 'Pattern in Focus', tags: ['pattern', 'clean'] },
  { name: 'Pattern With Restraint', tags: ['pattern', 'balanced'] },
  { name: 'Texture in Balance', tags: ['texture', 'balanced'] },
  { name: 'Quiet Texture', tags: ['texture', 'quiet'] },
  { name: 'Nothing Extra', tags: ['quiet', 'clean'] },
  { name: 'Understated Answer', tags: ['quiet', 'polished'] },
] as const;

const stableHash = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const dayKey = (now: number): string => {
  const date = new Date(now);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()].join('-');
};

export function styleContextFingerprint(context: StyleContext): string {
  const weather = context.weather
    ? [Math.round(context.weather.feelsLikeC / 4) * 4,
       Math.round(context.weather.precipitationChance * 4) / 4,
       context.weather.swing ? 1 : 0].join(':')
    : 'none';
  const events = context.events
    .map((event) => `${event.formality}:${event.occasion ?? ''}:${event.indoor ? 1 : 0}`)
    .sort()
    .join('|');
  return [dayKey(context.now), weather, events, context.targetFormality ?? '',
    context.targetOccasion ?? '', context.season ?? '',
    context.note?.trim().toLowerCase() ?? ''].join('::');
}

export function tagsForOutfit(candidate: OutfitCandidate, context: StyleContext): ReadonlySet<OutfitNameTag> {
  const tags = new Set<OutfitNameTag>();
  const items = candidate.items;
  const formality = items.length ? items.reduce((sum, item) => sum + item.formality, 0) / items.length : 3;
  if (formality >= 4) tags.add('formal');
  else if (formality >= 2.75) tags.add('polished');
  else tags.add('casual');
  const feels = context.weather?.feelsLikeC;
  if (feels !== undefined && feels <= 10) tags.add('warm');
  if (feels !== undefined && feels >= 23) tags.add('light');
  if ((context.weather?.precipitationChance ?? 0) >= 0.45) tags.add('rain');
  if (items.some((item) => item.slot === 'mid_layer' || item.slot === 'outerwear')) tags.add('layered');
  if (items.some((item) => item.slot === 'outerwear')) tags.add('outerwear');
  if (items.some((item) => item.slot === 'dress')) tags.add('dress');
  else tags.add('separates');
  if (items.some((item) => ['bag', 'headwear', 'accessory'].includes(item.slot))) tags.add('accessorized');
  if (items.some((item) => item.patternScale !== 'none')) tags.add('pattern');
  else tags.add('quiet');
  if (new Set(items.map((item) => item.material).filter(Boolean)).size >= 2) tags.add('texture');
  const harmony = candidate.harmonies.join(' ');
  if (harmony.includes('neutral')) tags.add('neutral');
  else if (harmony.includes('monochromatic') || harmony.includes('analogous')) tags.add('tonal');
  else if (harmony.includes('complementary') || harmony.includes('contrast')) tags.add('contrast');
  else tags.add('colour');
  if (candidate.features.proportion >= 0.78) tags.add('balanced');
  if (items.some((item) => item.fit === 'relaxed' || item.fit === 'oversized')) tags.add('relaxed');
  else tags.add('clean');
  return tags;
}

function rankedOptions(candidate: OutfitCandidate, context: StyleContext): OutfitNameEntry[] {
  const tags = tagsForOutfit(candidate, context);
  const seed = `${candidate.items.map((item) => item.id).sort().join('.')}::${styleContextFingerprint(context)}`;
  return [...OUTFIT_NAME_LIBRARY].sort((a, b) => {
    const score = (entry: OutfitNameEntry) => entry.tags.reduce((n, tag) => n + (tags.has(tag) ? 1 : 0), 0);
    const difference = score(b) - score(a);
    return difference || stableHash(`${seed}:${a.name}`) - stableHash(`${seed}:${b.name}`);
  });
}

export function compatibleNameOptions(candidate: OutfitCandidate, context: StyleContext, limit = 8): string[] {
  return rankedOptions(candidate, context).slice(0, limit).map((entry) => entry.name);
}

export function nameOutfits(candidates: readonly OutfitCandidate[], context: StyleContext): Map<string, string> {
  const used = new Set<string>();
  const names = new Map<string, string>();
  for (const candidate of candidates) {
    const id = candidate.items.map((item) => item.id).join('.');
    const name = rankedOptions(candidate, context).find((entry) => !used.has(entry.name))?.name
      ?? 'The Everyday Edit';
    used.add(name);
    names.set(id, name);
  }
  return names;
}

export function acceptEnhancedName(
  proposed: string,
  candidate: OutfitCandidate,
  context: StyleContext,
  used: ReadonlySet<string>,
): string | null {
  const name = proposed.trim().replace(/\s+/g, ' ');
  const words = name.split(' ');
  if (words.length < 2 || words.length > 4 || used.has(name)) return null;
  return compatibleNameOptions(candidate, context, 12).includes(name) ? name : null;
}
