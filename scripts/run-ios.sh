#!/usr/bin/env bash
#
# Build and launch Cinch on the iOS Simulator.
#
# The only step here that needs your password is the first one. Everything
# after it is ordinary tooling.
#
# Why the sudo step exists: uninstalling Xcode-beta left the system-wide
# developer-directory symlink pointing at a path that no longer exists.
#
#   /var/db/xcode_select_link -> /Applications/Xcode-beta.app/Contents/Developer
#
# `xcrun` quietly falls back to the real Xcode, which is why most commands still
# work and the problem is easy to miss. CoreSimulator does not fall back — it
# refuses to register any simulator runtime against an Xcode that is not there.
# So the iOS 26.5 runtime downloads, verifies, mounts, and then stays invisible,
# and asset-catalog compilation fails with "No simulator runtime version from
# [24A5390f] available to use with iphonesimulator SDK version 23F81a".
#
# Usage:  ./scripts/run-ios.sh
set -euo pipefail

XCODE="/Applications/Xcode.app/Contents/Developer"
DEVICE_NAME="Cinch iPhone 17 Pro"
BUNDLE_ID="com.nelsonsaenz.cinch"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export DEVELOPER_DIR="$XCODE"
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# ---------------------------------------------------------------------------
step "1/7  Point the system at Xcode 26 (this is the part that needs sudo)"

if [ "$(readlink /var/db/xcode_select_link 2>/dev/null)" = "$XCODE" ]; then
  echo "    Already correct — skipping."
else
  echo "    Currently: $(readlink /var/db/xcode_select_link 2>/dev/null || echo 'unset')"
  sudo xcode-select -s "$XCODE"
  echo "    Now: $(readlink /var/db/xcode_select_link)"
fi

# The daemon caches its runtime list at launch, so it has to be restarted before
# it will notice the iOS 26.5 runtime. launchd brings it straight back up.
step "2/7  Restart CoreSimulator so it re-reads the runtime list"
killall -9 com.apple.CoreSimulator.CoreSimulatorService 2>/dev/null || true
sleep 5

step "3/7  Confirm the iOS 26 runtime is visible"
if ! xcrun simctl list runtimes | grep -q "iOS 26"; then
  echo "    iOS 26 runtime still not registered. Downloading (~8 GB)..."
  xcodebuild -downloadPlatform iOS
  killall -9 com.apple.CoreSimulator.CoreSimulatorService 2>/dev/null || true
  sleep 5
fi
xcrun simctl list runtimes | grep -i ios || true

RUNTIME=$(xcrun simctl list runtimes | grep -o "com.apple.CoreSimulator.SimRuntime.iOS-26-[0-9]*" | head -1)
if [ -z "$RUNTIME" ]; then
  echo "    ERROR: no iOS 26 runtime available. Open Xcode > Settings > Components"
  echo "           and install an iOS 26 simulator runtime, then re-run this script."
  exit 1
fi

step "4/7  Boot a simulator on $RUNTIME"
UDID=$(xcrun simctl list devices | grep "$DEVICE_NAME" | grep -oE "[0-9A-F-]{36}" | head -1 || true)
if [ -z "$UDID" ]; then
  UDID=$(xcrun simctl create "$DEVICE_NAME" "iPhone 17 Pro" "$RUNTIME")
  echo "    Created $DEVICE_NAME"
fi
xcrun simctl boot "$UDID" 2>/dev/null || true
open -a Simulator 2>/dev/null || true
echo "    Booted $UDID"

step "5/7  Regenerate the native project from app.config.ts"
cd "$PROJECT_ROOT"
# Not optional, and easy to skip by mistake. `ios/` is generated and gitignored,
# so it does not track changes to app.config.ts on its own — adding a plugin
# (expo-location, expo-calendar) without re-running this produces a build with
# neither the pod nor the Info.plist purpose string. The app then crashes the
# first time it asks for that permission, at runtime, with nothing at build time
# to warn you. Prebuild is idempotent and runs pod install itself.
npx expo prebuild --platform ios | tail -4

step "6/7  Build (Release, so the JS bundles in and no Metro server is needed)"
xcodebuild \
  -workspace ios/Cinch.xcworkspace \
  -scheme Cinch \
  -configuration Release \
  -sdk iphonesimulator \
  -destination "id=$UDID" \
  -derivedDataPath ios/build \
  CODE_SIGNING_ALLOWED=NO \
  build | tail -5

APP="$PROJECT_ROOT/ios/build/Build/Products/Release-iphonesimulator/Cinch.app"
if [ ! -d "$APP" ] || [ -z "$(ls -A "$APP")" ]; then
  echo "    ERROR: build produced no app bundle at $APP"
  exit 1
fi

step "7/7  Install and launch"
xcrun simctl install "$UDID" "$APP"
xcrun simctl launch "$UDID" "$BUNDLE_ID"

printf '\n\033[1mCinch is running.\033[0m Sign in with Apple, then add clothes.\n'
