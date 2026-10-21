import { Platform } from 'react-native';

/**
 * Qué puede hacer la plataforma actual. Las pantallas consultan esto en vez de `Platform.OS`
 * para ocultar funciones no disponibles (ver PLAN.md §3.1).
 */
export const capabilities = {
  /** Notificaciones locales programadas (recordatorios del sistema). */
  localNotifications: Platform.OS !== 'web',
  /** Búsqueda FTS5. En web el WASM por defecto de expo-sqlite no la incluye: se usa LIKE. */
  fullTextSearch: Platform.OS !== 'web',
  biometrics: Platform.OS !== 'web',
  hapticFeedback: Platform.OS !== 'web',
  homeScreenWidgets: Platform.OS !== 'web',
  shareExtension: Platform.OS !== 'web',
  quickActions: Platform.OS !== 'web',
} as const;

export type Capability = keyof typeof capabilities;
