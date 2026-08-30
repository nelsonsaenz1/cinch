/**
 * Where an inspiration comes from — the seam that lets a second provider join
 * the recreate pipeline without a second matcher.
 *
 * No runtime dependency, deliberately: the node suite imports this file to
 * prove the gate below, and the picker that actually touches
 * `expo-image-picker` lives next door in `pick-inspiration.ts` so that
 * importing the RULES never drags a native module into the test graph
 * (`tour-layout.test.ts:135` forbids exactly that).
 *
 * The pipeline downstream of here is already provider-neutral and stays that
 * way: `analyze-inspiration` reads ONE image, `match.ts` ranks the closet on
 * device, `save-look.ts` writes only real garment IDs. What differs between
 * sources is not how a look is answered — it is what Cinch is ALLOWED TO DO
 * with the picture, and that is the whole reason this file exists.
 *
 * So the union below splits on CUSTODY, not on branding:
 *
 *   `local`  — Cinch holds a file it may copy into the caller's private
 *              Storage folder and send for analysis. The person's own library
 *              photo is always this. A provider's picture becomes this only
 *              where the provider has authorized it in writing.
 *
 *   `remote` — a picture that stays the provider's. Cinch may display it and
 *              link to it, and may do nothing else: not copy it, not upload
 *              it, not hand it to a model. Those are precisely the storage
 *              and third-party sharing a developer agreement typically
 *              forbids.
 *
 * Attribution is orthogonal to custody. Whose picture it is and what Cinch may
 * do with it are different questions, and collapsing them is how a credit line
 * ends up standing in for a permission.
 */

/** The photo library, plus any provider that later joins it. */
export type InspirationProvider = 'photo' | 'pinterest';

/** Every provider except the person's own library needs crediting. */
export type CreditedProvider = Exclude<InspirationProvider, 'photo'>;

export type InspirationAttribution = {
  provider: CreditedProvider;
  /**
   * The provider's OWN canonical address for this inspiration, as the
   * provider returned it. Never assembled from an ID or guessed from a
   * pattern — a constructed link can outlive the thing it points at and turn
   * attribution into a dead end.
   */
  sourceUrl: string;
  /** What the credit line reads, e.g. "From Pinterest". */
  label: string;
};

/** A picture Cinch holds and may process. Carries a credit when it is owed. */
export type LocalInspiration = {
  kind: 'local';
  provider: InspirationProvider;
  imageUri: string;
  width: number;
  height: number;
  attribution: InspirationAttribution | null;
};

/** A picture that stays the provider's: displayable, linkable, nothing more. */
export type RemoteInspiration = {
  kind: 'remote';
  provider: CreditedProvider;
  imageUri: string;
  /** Not nullable: a remote picture without a credit may not be shown. */
  attribution: InspirationAttribution;
};

export type InspirationCandidate = LocalInspiration | RemoteInspiration;

// ---------------------------------------------------------------------------
// The analysis gate
// ---------------------------------------------------------------------------

/**
 * Which providers have given Cinch WRITTEN permission to send their imagery to
 * a third-party model provider (OpenRouter, via `analyze-inspiration`).
 *
 * Every entry is false until an authorization actually exists and is recorded
 * in `docs/design/pinterest-style-inspiration-plan.md`. Flipping one on the
 * strength of "their terms probably allow it" is the exact mistake the plan's
 * analysis gate was written to prevent: a provider saying it does not train on
 * your data is not the same as a provider letting you transmit its data for
 * inference.
 */
export const PROVIDER_ANALYSIS_AUTHORIZED: Record<CreditedProvider, boolean> = {
  pinterest: false,
};

/** Bounded, like every other cause the recreate screen can show. */
export type AnalysisRefusal = 'provider_processing_unauthorized';

/**
 * May this candidate be uploaded and read by the analyzer?
 *
 * A type guard rather than a boolean, so the upload path cannot compile
 * against a candidate whose file Cinch does not hold. The gate itself lives
 * upstream in `pickInspiration`, which refuses to MATERIALIZE an unauthorized
 * provider's picture as `local` in the first place; this is the fail-closed
 * end of the same rule, and adding a provider without answering the
 * authorization question therefore breaks here rather than shipping.
 */
export function mayAnalyze(candidate: InspirationCandidate): candidate is LocalInspiration {
  return candidate.kind === 'local';
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

/** Why a source cannot be offered right now. Bounded, and never quoted back. */
export type SourceUnavailable = 'not_configured';

export type InspirationSource = {
  provider: InspirationProvider;
  title: string;
  blurb: string;
  /** Null means offerable. Anything else means the door must not be drawn. */
  unavailable: SourceUnavailable | null;
};

export const INSPIRATION_SOURCES: readonly InspirationSource[] = [
  {
    provider: 'photo',
    title: 'A photo you saved',
    blurb: 'Screenshots and outfit photos both work.',
    unavailable: null,
  },
  {
    provider: 'pinterest',
    title: 'A board on Pinterest',
    blurb: 'Pick one board. Cinch reads it for inspiration only.',
    // Not a feature flag and not a placeholder: there is no Pinterest
    // developer application, client credential, or redirect URI in this
    // project, so the source genuinely cannot be offered. Phase 2 replaces
    // this constant with a real per-user connection lookup; until then the
    // only honest answer is that it is not configured.
    unavailable: 'not_configured',
  },
];

export function availableSources(): InspirationSource[] {
  return INSPIRATION_SOURCES.filter((s) => s.unavailable === null);
}

/**
 * Whether the screen should draw a chooser at all.
 *
 * With one source a chooser is not a choice — it is an extra tap in front of
 * the only door, which is strictly worse than the flow that ships today. So
 * the chooser appears when a second source genuinely becomes offerable and not
 * one release before.
 */
export function sourceChoiceNeeded(): boolean {
  return availableSources().length > 1;
}

/** Whether a source may be offered at all. `pick-inspiration.ts` obeys this. */
export function isOfferable(provider: InspirationProvider): boolean {
  const source = INSPIRATION_SOURCES.find((s) => s.provider === provider);
  return source ? source.unavailable === null : false;
}
