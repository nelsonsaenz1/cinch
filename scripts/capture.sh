#!/usr/bin/env bash
# Record a marketing clip off the iOS simulator, with Apple's clean status bar.
#
#   ./scripts/capture.sh cap-reveal        # start recording -> ^C to stop
#
# Output lands in marketing/01-captures/<name>-v1.mov at 1320x2868 on an
# iPhone 16 Pro Max sim, which is the App Store 6.9" size exactly — no scaling.
#
# The status-bar override is the point of this script. Without it every clip
# shows a different battery level and a stray carrier name, and they cannot be
# intercut. Run it once per boot; it persists until the sim restarts.
set -euo pipefail

NAME="${1:?usage: capture.sh <clip-name>   e.g. capture.sh cap-reveal}"
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/marketing/01-captures"
mkdir -p "$OUT_DIR"

# Pick the next version rather than clobbering a take you might still want.
n=1; while [ -e "$OUT_DIR/$NAME-v$n.mov" ]; do n=$((n+1)); done
OUT="$OUT_DIR/$NAME-v$n.mov"

if ! xcrun simctl list devices booted | grep -q Booted; then
  echo "No booted simulator. Start one first:"
  echo "  npx expo run:ios     # or open -a Simulator"
  exit 1
fi

xcrun simctl status_bar booted override \
  --time "9:41" \
  --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 \
  --batteryState charged --batteryLevel 100 >/dev/null 2>&1 || true

echo "Recording -> $OUT"
echo "Tap through the flow. Ctrl-C when the beat is finished."
echo "Hold two seconds at the end so there is a clean cut point."
xcrun simctl io booted recordVideo --codec h264 --force "$OUT"
