const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web implementation ships SQLite as WebAssembly
// (web/wa-sqlite/wa-sqlite.wasm) and imports it from its worker. Metro
// resolves only what its extension lists name, and `.wasm` is in neither
// sourceExts nor assetExts by default — so any import chain that reaches
// `expo-sqlite/kv-store` (queue-store, capture, local-photos) breaks the web
// bundle of `expo export --platform all`. Registering it as an asset is the
// fix Expo's own SQLite web guide prescribes.
config.resolver.assetExts.push('wasm');

// The wasm build uses SharedArrayBuffer, which browsers only enable on
// cross-origin-isolated pages. Only the dev server needs these headers here —
// a production host sets its own.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = withNativeWind(config, { input: './src/global.css' });
