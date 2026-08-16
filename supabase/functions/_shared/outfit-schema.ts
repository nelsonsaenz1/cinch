/**
 * Schema and prompt for outfit re-ranking.
 *
 * The model does NOT choose outfits from a closet. The on-device engine has
 * already enumerated every valid combination, scored each on colour harmony,
 * formality, weather, silhouette, pattern and learned preference, and sent up a
 * shortlist. The model's job is the part arithmetic is bad at: reading the
 * user's own words about their day, breaking near-ties on taste, and writing a
 * sentence that sounds like a person.
 *
 * That division is what makes the economics work — no images, no closet dump,
 * a prompt of a few hundred tokens instead of tens of thousands — and it is
 * also what keeps the output honest. The model cannot hallucinate a garment,
 * because it can only return ids that were sent to it.
 */

export const outfitSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['picks'],
  properties: {
    picks: {
      type: 'array',
      description:
        'The chosen candidates, best first. Never invent an id — use only ids that were provided.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['candidateId', 'name', 'reasoning', 'swapNote'],
        properties: {
          candidateId: {
            type: 'string',
            description: 'Must exactly match one of the supplied candidate ids.',
          },
          name: {
            type: 'string',
            description:
              'Must exactly match one of that candidate’s supplied Allowed names.',
          },
          reasoning: {
            type: 'string',
            description:
              'One or two sentences, second person, explaining why this works today. Reference the actual garments and the real weather or plans. Under 220 characters.',
          },
          swapNote: {
            type: ['string', 'null'],
            description:
              'For a day with several events at different formalities, the one piece to add or remove between them, and when. Name a piece belonging to THIS candidate — never a garment the user was not given, and never a candidate id. When the day needs no change, return null, the JSON value: never the word "None", "N/A", or any other stand-in for nothing, because this string is shown to the user exactly as written.',
          },
        },
      },
    },
  },
} as const;

export type OutfitPick = {
  candidateId: string;
  name: string;
  reasoning: string;
  swapNote: string | null;
};

export type OutfitRerank = { picks: OutfitPick[] };

/**
 * A note on the examples in this prompt, learned the hard way.
 *
 * An earlier draft illustrated the `name` field with "Rainy Tuesday". Smaller
 * models returned that string verbatim on a day with a 10% chance of rain —
 * copying the example straight past the actual forecast. Every example here is
 * therefore deliberately abstract and carries no weather, season, or garment,
 * so that lifting one wholesale cannot state something false.
 */
export const OUTFIT_SYSTEM_PROMPT = `You are the stylist inside Cinch, a digital wardrobe app. You are given a shortlist of outfits ALREADY assembled from clothes the user actually owns, plus today's weather and plans. Choose the best few and explain them.

HARD RULES
- Return only candidateIds that appear in the input. You cannot add, remove, or substitute garments — every candidate is a fixed set of real clothes.
- "name" MUST exactly match one of the candidate's supplied Allowed names. Never invent or rewrite a name.
- "reasoning" is one or two sentences, second person, naming the actual pieces and the real weather or plans. Under 220 characters. Write "the camel trench over the navy knit", not "this outfit".
- "swapNote": when the day's events differ in formality by 2 or more points, this MUST NOT be null. Name the single piece to add or remove, and when. It may only reference pieces belonging to THAT SAME candidate — never a garment from another candidate, and never a candidate id. Only use null when the day genuinely needs no change.
- "swapNote" names a piece the user owns, from that candidate. "Add a blazer" and "bring a light jacket" are not swaps — the user cannot act on a garment they were not given. Name the actual piece: "swap the navy knit for the camel trench before dinner".
- When there is no change to make, "swapNote" is null, the JSON value. Never the word "None", never "N/A", never "no swap needed", never an empty string. This field is printed to the user exactly as you write it, so a placeholder word appears on their screen as if it were advice.
- The engine's scores and bracketed notes are grounded facts about colour harmony, warmth, formality and silhouette. Trust them for those judgements. Use your own judgement for what the user said about their day.
- Never invent a brand, garment, colour, or plan you were not given. Do not describe the weather as anything the numbers do not support.
- No emoji. No exclamation marks. No "elevate your look", "effortlessly chic", "perfect for any occasion", or similar filler.`;
