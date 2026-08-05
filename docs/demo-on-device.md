# Running Cinch on your own iPhone

## Expo Go will not work — and cannot be made to

Cinch depends on native code Expo Go does not bundle: `react-native-quick-crypto`
(the encrypted session store), `@shopify/react-native-skia`, `@shopify/flash-list`,
`react-native-view-shot` (the share poster), `expo-apple-authentication`,
`@expo/ui` and `expo-glass-effect` — plus a custom `cinch://` URL scheme and a
hand-written `Info.plist`. Expo Go can only run apps built from its own fixed set
of modules. That is why `expo-dev-client` is already a dependency: this app has
always needed its own build.

Stripping those out to fit Expo Go would remove sign-in, the closet grid and the
share card. It would be a different, worse app — not a demo of this one.

---

## Option A — free sideload (no paid Apple account)

Works today with a plain Apple ID. **The app stops launching after 7 days**;
rebuild to renew. Needs the iPhone plugged into this Mac.

### 1. Switch the project to free-team signing

```bash
scripts/free-signing.sh on
```

A free Apple "Personal Team" is not allowed to sign the **Sign in with Apple**
capability — Xcode fails outright with *"Personal development teams do not
support the Sign in with Apple capability."* The script removes that entitlement
and sets `CINCH_FREE_SIGNING=1` in `.env.local`, which makes the welcome screen
hide the Apple button. **Email sign-in becomes the only way in** (see Prerequisite
below).

### 2. Sign the app with your Apple ID

1. `open ios/Cinch.xcworkspace`
2. Select the **Cinch** target → **Signing & Capabilities**
3. Tick **Automatically manage signing**
4. **Team** → *Add an Account…* → sign in with your Apple ID → pick the
   `(Personal Team)` entry
5. If it complains the bundle identifier is taken, change **Bundle Identifier**
   to something unique, e.g. `com.<yourname>.cinch.demo`

### 3. Build to the phone

1. Plug the iPhone in; unlock it; **Trust This Computer**
2. Pick your iPhone from the device menu at the top of Xcode
3. Choose the **Release** scheme — Product → Scheme → Edit Scheme → Run →
   Build Configuration → **Release**. This embeds the JavaScript, so the app runs
   standalone and does not need this Mac or Metro afterwards. (Debug also works,
   but then the phone must stay on the same Wi-Fi as Metro.)
4. Press ▶︎ (Run)

### 4. Trust the developer certificate on the phone

First launch will refuse with "Untrusted Developer":

**Settings → General → VPN & Device Management → your Apple ID → Trust**

### 5. When your paid account is approved

```bash
scripts/free-signing.sh off
```

This restores Sign in with Apple. Do this **before** any TestFlight or App Store
build — Guideline 4.8 requires Apple sign-in once another social login exists.

---

## Option B — EAS build (once the paid account lands)

No cable, installs over the air, lasts a year, and others can install it too.

```bash
npx eas-cli@latest login
npx eas-cli@latest build --platform ios --profile development-device
```

`eas.json` already carries `development-device` (dev client, internal
distribution) and `preview` (standalone, internal distribution) profiles. EAS
will register the device UDID and handle certificates. For wider sharing, use
TestFlight: `--profile production` then `eas submit` (fill in the placeholder
`ascAppId` / `appleTeamId` in `eas.json` first).

---

## Prerequisite for the free build: email sign-in must work

The free build has no Apple sign-in, so the magic link is the only door. Confirm
in the Supabase dashboard (project `dugizuswuebrmcmvinmi`):

**Authentication → URL Configuration → Redirect URLs** must include:

```
cinch://auth-callback
```

Without it the link opens but the session never lands. Note the default Supabase
mailer is rate-limited to a few messages an hour on the free tier — fine for a
demo, not for a crowd.

If you change the bundle identifier in step 2, the `cinch://` scheme still comes
from `app.config.ts` (`scheme: 'cinch'`) and does not change.
