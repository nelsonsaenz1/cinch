import { AvFrame, SEEN_ONLY } from './av-frames';

/**
 * DEV ONLY · AV-06 — everything already seen.
 *
 * `cinch:///dev-av-06-no-unseen`. No dots, no `New` heading, and nothing
 * announcing zero. The absence of the dot is the entire message.
 *
 * It is also the frame that pins `showsSectionHeadings`: one section needs no
 * eyebrow over it, because a heading spanning the whole list labels the list,
 * which the title already did.
 */
export default function DevAv06NoUnseen() {
  return <AvFrame status="ready" sections={SEEN_ONLY} />;
}
