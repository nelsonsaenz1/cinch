/**
 * The four consent facts — the exact wording, in one place, in a file with no
 * React in it.
 *
 * WHY THIS IS ITS OWN MODULE
 *
 * Two screens must show these sentences and they must be the SAME sentences.
 * `ConsentSheet` asks with them; the privacy page (PD-02) quotes them back,
 * because atlas 38's rule is "consent is re-readable: the withdrawal screen
 * shows the ORIGINAL wording, not a summary of it". A second copy satisfies
 * that rule only for as long as the two copies agree, and the moment they
 * drift the page is telling somebody they agreed to wording they never saw —
 * which is worse than showing no wording at all.
 *
 * The obvious fix, exporting the array from `consent-sheet.tsx`, does not
 * work: the privacy page's copy lives in a `.ts` that `scripts/run-tests.mjs`
 * bundles with esbuild, and esbuild cannot parse React Native's Flow source.
 * Importing a `.tsx` into it takes the whole test suite down. So the shared
 * thing is a plain module, and both sides import from here.
 *
 * ON THE CONTENT: every claim is one this app can prove about ITS OWN
 * behaviour. `docs/design/system-safety-contract.md` §3 is explicit that a
 * retention or no-training promise about the AI partner is not something Cinch
 * has verified, and printing one in a consent sheet would be the worst
 * sentence the app could contain. Editing these changes what the sheet asks
 * AND what the privacy page quotes, together — which is the only safe way for
 * them to change.
 */

export type ConsentFact = {
  /** The bolded opening clause. */
  lead: string;
  /** The rest of the sentence, in the regular cut. Leading space included. */
  rest: string;
};

export const CONSENT_FACTS: readonly ConsentFact[] = [
  {
    lead: 'The photo goes to our AI partner,',
    rest: ' which returns a category, colour and fabric.',
  },
  {
    // WAS: "It goes to one AI partner and comes straight back. We don't send
    // your name, your email, your location, or anything else from your
    // closet." Two halves, both wrong, both shipping since the consent sheet
    // was written.
    //
    // "One AI partner" — the provider is a ROUTER. With no routing policy set
    // it load-balanced across roughly thirty companies, so the sentence named
    // a number nobody had. The code now pins routing to providers that do not
    // train on what they receive (`_shared/openrouter.ts`), which is a promise
    // we can keep; the count still is not one, so the sentence no longer
    // claims it.
    //
    // "Nothing else" — the request carries a signed URL whose path contains
    // the account id, and the outfit call sends today's calendar event titles.
    // The name and email genuinely never travel, so that part stayed.
    //
    // See docs/ai-provider-terms.md for every quoted term and its source.
    // WHY THIS DOES NOT SAY "NOT USED FOR TRAINING" EITHER.
    //
    // The obvious fix was to pin routing to providers that do not train, and
    // then say so. The pin is a two-line change and it is written up in
    // docs/ai-provider-terms.md §5 — but it could not be VERIFIED from here:
    // OpenRouter's public endpoints API does not expose each provider's data
    // policy, so there was no way to confirm every configured model still has
    // a qualifying endpoint. If one does not, the call is rejected and tagging
    // stops working for everybody.
    //
    // Shipping an unverified routing restriction to earn a nicer sentence is
    // the wrong trade. The sentence waits; it costs nothing to under-claim.
    lead: 'It goes out to be read and comes straight back.',
    rest: ' Your name and your email never go with it.',
  },
  {
    lead: 'We keep the photo and the tags',
    rest: ' in your closet. Deleting an item deletes both.',
  },
  {
    lead: 'We never run face recognition,',
    rest: ' here or anywhere in Cinch.',
  },
];
