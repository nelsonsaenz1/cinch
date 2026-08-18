import { TourPose } from '@/dev-fixtures/tour-pose';

/**
 * DEV ONLY · TR-02 — the camera, drawn and never opened.
 *
 * Deep-linkable: `cinch:///dev-tr-02-camera?composition=large`.
 *
 * This is the frame the tour's one absolute rule lives on. What it draws is a
 * viewfinder made of four border marks and a tilted polygon; there is no camera
 * module anywhere in its graph and no permission is requested by opening it.
 * `?composition=large` drops the result card's caption, which is the
 * accessibility frame's own composition change.
 */
export default function DevTr02Camera() {
  return <TourPose id="TR-02" />;
}
