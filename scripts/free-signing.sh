#!/usr/bin/env bash
#
# Toggle the app between "free Apple personal team" and "paid Apple Developer
# Program" signing.
#
# WHY THIS EXISTS
#
# Installing on a real iPhone requires Apple code signing. A free Apple ID
# ("Personal Team") can sign an app, but Apple does not let it sign certain
# capabilities — Sign in with Apple among them. With
# com.apple.developer.applesignin in the entitlements, Xcode refuses the build:
#
#   Personal development teams do not support the Sign in with Apple capability.
#
# So a free-team build has to ship without that entitlement. The app already
# copes: the welcome screen asks AppleAuthentication.isAvailableAsync() and
# simply hides the Apple button when the capability is absent, leaving the
# email link as the way in.
#
# This is a LOCAL, REVERSIBLE change to a generated file. It must never reach a
# TestFlight or App Store build, or Sign in with Apple silently disappears from
# the shipping app — and Guideline 4.8 requires it once any other social login
# is offered.
#
# USAGE
#   scripts/free-signing.sh on    # strip the entitlement, for a free-team build
#   scripts/free-signing.sh off   # restore it, for a paid-account build
#   scripts/free-signing.sh status
#
set -euo pipefail

ENT="ios/Cinch/Cinch.entitlements"
ENVF=".env.local"
FLAG="CINCH_FREE_SIGNING=1"
cd "$(dirname "$0")/.."

[ -f "$ENT" ] || { echo "error: $ENT not found. Run from the repo, after prebuild."; exit 1; }

has_apple_signin() { grep -q "com.apple.developer.applesignin" "$ENT"; }

# The flag has to live in .env.local, not just the shell, because an Xcode
# Release build embeds the JS bundle itself and never sees an env var you
# exported in a terminal. Expo loads .env files when it evaluates app.config.ts,
# so this reaches both Metro and the Xcode bundling phase. The file is
# gitignored, so the flag stays local.
set_flag() {
  touch "$ENVF"
  grep -q "^${FLAG}$" "$ENVF" || printf '\n# Local personal-team build — see scripts/free-signing.sh\n%s\n' "$FLAG" >> "$ENVF"
}
clear_flag() {
  [ -f "$ENVF" ] || return 0
  # Drop the flag and the comment line that introduces it.
  grep -v "^${FLAG}$" "$ENVF" | grep -v "^# Local personal-team build" > "$ENVF.tmp" && mv "$ENVF.tmp" "$ENVF"
}

case "${1:-status}" in
  on)
    if has_apple_signin; then
      cat > "$ENT" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict/>
</plist>
PLIST
      echo "FREE SIGNING: ON — Sign in with Apple entitlement removed."
    else
      echo "FREE SIGNING: already on (no applesignin entitlement)."
    fi
    set_flag
    echo
    echo "  The app will offer EMAIL sign-in only. Restore before any paid build:"
    echo "    scripts/free-signing.sh off"
    ;;
  off)
    git checkout -- "$ENT" 2>/dev/null || cat > "$ENT" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.developer.applesignin</key>
    <array>
      <string>Default</string>
    </array>
  </dict>
</plist>
PLIST
    clear_flag
    echo "FREE SIGNING: OFF — Sign in with Apple entitlement restored."
    ;;
  status)
    if has_apple_signin; then
      echo "FREE SIGNING: off (Sign in with Apple present — needs a PAID account)."
    else
      echo "FREE SIGNING: on (no Sign in with Apple — a free personal team can build)."
    fi
    ;;
  *)
    echo "usage: $0 [on|off|status]"; exit 1
    ;;
esac
