import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Hay informes de errores en esta compilación: solo con DSN (en desarrollo, normalmente no) y
 * nunca durante el renderizado en servidor de la web.
 */
export const monitoringAvailable =
  !!DSN && !(Platform.OS === 'web' && typeof window === 'undefined');

/** Categorías de migas que pueden llevar texto del usuario (logs, etiquetas de botones, títulos). */
const PRIVATE_BREADCRUMBS = /^(console|touch|ui\.|xhr|fetch)/;

/**
 * Arranca Sentry (solo errores: sin trazas, capturas ni datos personales). Los eventos se
 * descartan hasta que se cargan los ajustes y siempre que el usuario haya desactivado los
 * informes en Ajustes → Privacidad.
 */
export function initMonitoring(): void {
  if (!monitoringAvailable) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    sendDefaultPii: false,
    tracesSampleRate: 0,
    attachScreenshot: false,
    attachViewHierarchy: false,
    beforeBreadcrumb: (breadcrumb) =>
      breadcrumb.category && PRIVATE_BREADCRUMBS.test(breadcrumb.category) ? null : breadcrumb,
    beforeSend: (event) => {
      if (!reportsAllowed()) return null;
      for (const exception of event.exception?.values ?? []) {
        if (exception.value) exception.value = scrubMessage(exception.value);
      }
      if (event.message) event.message = scrubMessage(event.message);
      delete event.user;
      return event;
    },
  });
}

function reportsAllowed(): boolean {
  return useSettingsStore.persist.hasHydrated() && useSettingsStore.getState().crashReports;
}

/**
 * Quita de un mensaje de error los valores que pueden ser contenido del usuario. Drizzle incluye
 * los parámetros de la consulta (títulos, texto de las notas) en `Failed query: …\nparams: …`.
 */
export function scrubMessage(message: string): string {
  return message.replace(/params:[\s\S]*$/, 'params: [redacted]');
}

/** Envía un error ya gestionado (p. ej. un fallo al arrancar que se muestra en pantalla). */
export function reportError(error: unknown): void {
  if (monitoringAvailable) Sentry.captureException(error);
}

export const wrapRoot = Sentry.wrap;
export const wrapErrorBoundary = Sentry.wrapExpoRouterErrorBoundary;
