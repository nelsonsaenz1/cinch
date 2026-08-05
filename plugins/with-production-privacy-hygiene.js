const { withInfoPlist } = require('expo/config-plugins');

/**
 * Strip development-only network declarations from the shipping Info.plist.
 *
 * `expo-dev-launcher`'s plugin adds `NSBonjourServices` (`_expo._tcp`) and an
 * `NSLocalNetworkUsageDescription` that literally reads "Expo Dev Launcher uses
 * the local network to discover and connect to development servers running on
 * your computer." Those are true and necessary for a dev build on a physical
 * device, and indefensible in a store build: the app would be asking a customer
 * for permission to scan their home network, with a string naming a tool they
 * do not have. That is a review question at best, and it contradicts the
 * privacy narrative the listing makes.
 *
 * The keys arrive from a dependency's plugin rather than from app.config.ts, so
 * there is nothing to "not declare" — they have to be removed after the fact.
 * This plugin runs last and takes them back out.
 *
 * Gating: `expo-dev-client` is a real dependency and prebuild is shared, so the
 * strip is conditional rather than absolute. It applies when EAS is building a
 * profile that is not `development`, and can be forced locally with
 * CINCH_STRIP_DEV_KEYS=1 — which is how the release plist gets verified without
 * running a full EAS build.
 */
const withProductionPrivacyHygiene = (config) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const forced = process.env.CINCH_STRIP_DEV_KEYS === '1';
  const isDevClientBuild = profile === 'development';

  // No EAS profile and no override means a plain local prebuild for day-to-day
  // development: leave the dev keys alone so device debugging keeps working.
  const shouldStrip = forced || (Boolean(profile) && !isDevClientBuild);
  if (!shouldStrip) return config;

  return withInfoPlist(config, (cfg) => {
    delete cfg.modResults.NSBonjourServices;
    delete cfg.modResults.NSLocalNetworkUsageDescription;
    return cfg;
  });
};

module.exports = withProductionPrivacyHygiene;
