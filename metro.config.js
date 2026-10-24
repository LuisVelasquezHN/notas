// https://docs.expo.dev/guides/customizing-metro/
const path = require('node:path');

const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { FileStore } = require('metro-cache');

// Configuración de Expo + Sentry (Debug IDs en los bundles para enlazar los source maps).
// Sin Session Replay ni widget de feedback en web: solo informes de errores.
const config = getSentryExpoConfig(__dirname, {
  includeWebReplay: false,
  includeWebFeedback: false,
});

// Migraciones SQL de drizzle-kit.
config.resolver.sourceExts.push('sql');

// expo-sqlite en web carga SQLite como WebAssembly.
config.resolver.assetExts.push('wasm');

// En Vercel la caché de Metro se guarda dentro de node_modules, que Vercel conserva entre builds:
// así solo se vuelve a compilar lo que cambió (por defecto va a una carpeta temporal y se pierde).
if (process.env.VERCEL || process.env.METRO_PERSISTENT_CACHE) {
  config.cacheStores = [
    new FileStore({ root: path.join(__dirname, 'node_modules', '.cache', 'metro') }),
  ];
}

module.exports = config;
