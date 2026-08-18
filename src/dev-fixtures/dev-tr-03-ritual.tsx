import { TourPose } from '@/dev-fixtures/tour-pose';

/**
 * DEV ONLY · TR-03 — the ritual, and the two real ways out.
 *
 * Deep-linkable: `cinch:///dev-tr-03-ritual?composition=short`.
 *
 * The last frame carries no Skip, because the two choices beneath it are both
 * honest ways out and a third quieter one would be a third answer to a question
 * that has two. The miniature Today renders its sample temperature through the
 * app's own formatter, so what is on screen here is what the app would print.
 */
export default function DevTr03Ritual() {
  return <TourPose id="TR-03" />;
}
