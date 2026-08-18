import { TenPoseScreen } from '@/dev-fixtures/ten-pose';

/**
 * DEV ONLY · T-09 · the camera switched off.
 *
 * Deep-linkable, and both recompositions are parameters rather than device
 * settings: `cinch:///dev-tt-09-denied?scale=1.5` draws the accessibility
 * composition and `?height=667` the short one, so every frame in this set can
 * be photographed on one simulator without touching iOS Settings.
 */
export default function DevTt09() {
  return <TenPoseScreen pose="denied" />;
}
