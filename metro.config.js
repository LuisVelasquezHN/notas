// https://docs.expo.dev/guides/customizing-metro/
const { getSentryExpoConfig } = require('@sentry/react-native/metro');

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

module.exports = config;
