#!/usr/bin/env bash
#
# Build Cinch and install it on a paired iPhone, signed with whatever Apple ID
# Xcode is logged into (a free Personal Team is fine).
#
# PREREQUISITE — do this once, in Xcode, by hand:
#   Xcode → Settings… → Accounts → "+" → Apple ID → sign in.
# Nothing here can do that for you; it needs your password and 2FA.
#
# Then just run:
#   scripts/install-device.sh
#
# It picks the signing team and the device automatically, builds Release (so the
# JavaScript is embedded and the app runs with no Mac and no Metro), and
# installs. First launch will say "Untrusted Developer" — approve it under
# Settings → General → VPN & Device Management.
#
# A free team's build stops launching after 7 days. Re-run this to renew.
#
set -euo pipefail
cd "$(dirname "$0")/.."

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }

# ---- 1. Signing team ---------------------------------------------------------
TEAM="${CINCH_TEAM_ID:-}"
if [ -z "$TEAM" ]; then
  # "Apple Development: Name (XXXXXXXXXX)" — the trailing parenthesised value is
  # the team ID for a personal team.
  TEAM=$(security find-identity -v -p codesigning 2>/dev/null \
    | sed -n 's/.*"Apple Development: .*(\([A-Z0-9]\{10\}\))".*/\1/p' | head -1)
fi
if [ -z "$TEAM" ]; then
  cat <<'MSG'
No code-signing identity found.

Sign in first — this is the one step that cannot be automated:

  1. open -a Xcode
  2. Xcode → Settings… → Accounts → "+" → Apple ID → sign in
  3. Close Xcode, then run this script again

(If you know your team ID you can skip detection: CINCH_TEAM_ID=XXXXXXXXXX scripts/install-device.sh)
MSG
  exit 1
fi
say "Signing team: $TEAM"

# ---- 2. Device ---------------------------------------------------------------
DEVICE="${CINCH_DEVICE_ID:-}"
if [ -z "$DEVICE" ]; then
  # Physical devices only — anything reported as "simulated" is not a phone.
  DEVICE=$(xcrun devicectl list devices 2>/dev/null \
    | grep -v simulated | grep -iE "connected|available" \
    | sed -n 's/.*\([0-9A-F]\{8\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{4\}-[0-9A-F]\{12\}\).*/\1/p' | head -1)
fi
if [ -z "$DEVICE" ]; then
  echo "No paired iPhone found. Plug it in, unlock it, and tap Trust." >&2
  exit 1
fi
say "Device: $DEVICE"

# ---- 2b. Developer Mode ------------------------------------------------------
# iOS 16+ refuses to run a development build until Developer Mode is on, and the
# failure only surfaces after a full build otherwise. Check first.
if xcrun devicectl device info details --device "$DEVICE" 2>&1 | grep -qi "developerModeStatus.*disabled"; then
  cat <<'MSG'

Developer Mode is OFF on the iPhone. iOS will not run a development build until
it is enabled, and the phone restarts when you turn it on.

  On the phone:  Settings → Privacy & Security → Developer Mode → on
                 Confirm the restart, then unlock and tap "Turn On" again.

(The Developer Mode row only appears after a Mac has tried to install to the
phone — which has now happened, so it will be there.)

Then run this script again.
MSG
  exit 1
fi

# ---- 3. Free-team signing can't carry Sign in with Apple ---------------------
if grep -q "com.apple.developer.applesignin" ios/Cinch/Cinch.entitlements 2>/dev/null; then
  say "Switching to free-team signing (removes the Sign in with Apple entitlement)"
  scripts/free-signing.sh on
fi

# ---- 4. Build ----------------------------------------------------------------
say "Building Release — this takes a few minutes"
xcodebuild \
  -workspace ios/Cinch.xcworkspace \
  -scheme Cinch \
  -configuration Release \
  -destination "id=$DEVICE" \
  -derivedDataPath ios/build-device \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates \
  build | tail -5

APP=$(find ios/build-device/Build/Products -maxdepth 2 -name "Cinch.app" -path "*iphoneos*" | head -1)
[ -n "$APP" ] || { echo "Build produced no Cinch.app" >&2; exit 1; }

# ---- 5. Install --------------------------------------------------------------
say "Installing $APP"
xcrun devicectl device install app --device "$DEVICE" "$APP"

cat <<'MSG'

Done. On the phone:

  Settings → General → VPN & Device Management → your Apple ID → Trust

Then open Cinch. Sign in with the email link (a free-team build has no Apple
sign-in). The build stops launching after 7 days — re-run this script to renew.
MSG
