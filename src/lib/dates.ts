import { currentLocale, t, type TFunction } from '@/i18n';

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Días que una nota permanece en la papelera antes de borrarse definitivamente. */
export const TRASH_RETENTION_DAYS = 30;

/** Días que le quedan a una nota en la papelera (mínimo 0). */
export function daysLeftInTrash(deletedAt: number, now: number = Date.now()): number {
  const expiresAt = deletedAt + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}

/**
 * Fecha corta y relativa para las tarjetas: "Ahora", "Hace 5 min", "Ayer", "12 mar", "12 mar 2024".
 * En el render, pasa el `t` de `useTranslation()` (ver `@/i18n`).
 */
export function formatRelativeDate(
  timestamp: number,
  now: number = Date.now(),
  tr: TFunction = t,
): string {
  const diff = now - timestamp;
  if (diff < 60_000) return tr('dates.now');
  if (diff < 3_600_000) return tr('dates.minutesAgo', { count: Math.floor(diff / 60_000) });

  const locale = currentLocale();
  const date = new Date(timestamp);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (timestamp >= startOfToday) {
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  }
  if (timestamp >= startOfToday - DAY_MS) return tr('dates.yesterday');

  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
