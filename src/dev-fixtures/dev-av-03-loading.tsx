import { AvFrame } from './av-frames';

/**
 * DEV ONLY · AV-03 — the first read, in flight.
 *
 * `cinch:///dev-av-03-loading`. Six skeletons at the real row rhythm — a 44pt
 * disc, two bars, a hairline — and the colophon holding its position so the page
 * does not jump when the rows land.
 *
 * The status sentence is not drawn and is still announced: it is a zero-height
 * polite live region, so a reader who has just pushed this screen and cannot see
 * it is told that something is happening. See `ActivitySkeleton`.
 */
export default function DevAv03Loading() {
  return <AvFrame status="loading" sections={[]} />;
}
