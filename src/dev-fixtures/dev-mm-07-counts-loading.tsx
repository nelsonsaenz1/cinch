import { MmFrame } from './mm-frames';

/**
 * DEV ONLY · MM-07 — tier confirmed, counts still loading.
 *
 * `cinch:///dev-mm-07-counts-loading`. The frame
 * `membership-standard-counts-loading-omitted`. The numbers are omitted rather
 * than shown as zero or a dash: `0 of 150` is a claim about somebody's closet,
 * and a wrong count on a capacity page is worse than a moment of nothing. The
 * plate is still drawn, so the page does not reflow when they land.
 */
export default function DevMm07CountsLoading() {
  return <MmFrame used={null} stored={null} />;
}
