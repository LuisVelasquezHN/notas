// https://docs.expo.dev/guides/customizing-metro/
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Migraciones SQL de drizzle-kit.
config.resolver.sourceExts.push('sql');

// expo-sqlite en web carga SQLite como WebAssembly.
config.resolver.assetExts.push('wasm');

// El driver de Drizzle usa la API síncrona de expo-sqlite, que en web necesita SharedArrayBuffer,
// y el navegador solo la habilita con estas cabeceras. En modo `single` el CLI de Expo sirve el HTML
// antes que el middleware de Metro (`enhanceMiddleware` no llega), así que en desarrollo las añadimos
// a todas las respuestas del servidor. En producción las pone el hosting (ver app.json y PLAN.md §3.1).
const CROSS_ORIGIN_ISOLATION_HEADERS = {
  'Cross-Origin-Embedder-Policy': 'credentialless',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
const writeHead = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (...args) {
  if (!this.headersSent) {
    for (const [name, value] of Object.entries(CROSS_ORIGIN_ISOLATION_HEADERS)) {
      if (!this.hasHeader(name)) this.setHeader(name, value);
    }
  }
  return writeHead.apply(this, args);
};

module.exports = config;
