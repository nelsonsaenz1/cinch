import { AvFrame, EDGES } from './av-frames';

/**
 * DEV ONLY · AV-08 — the two rows that look broken and are not.
 *
 * `cinch:///dev-av-08-edges`.
 *
 * THE MISSING ACTOR. `actor_id` is `on delete set null`, and a co-member who is
 * a stranger to the reader resolves to no name either way. The row says "A Cinch
 * member" over a neutral mark, the fallback is a COMMON NOUN so it takes no
 * emphasis, and no public profile is queried to fill the gap.
 *
 * THE REVOKED INVITATION. Unseen, and filed by AGE under `Earlier` rather than
 * under `New` — a withdrawn invitation must never summon a reader to something
 * that is gone. It still opens, because AC-05 is the only place its
 * disappearance is explained, and it carries no inline Accept.
 */
export default function DevAv08Edges() {
  return <AvFrame status="ready" sections={EDGES} />;
}
