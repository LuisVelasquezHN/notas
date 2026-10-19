export const DAY_MS = 24 * 60 * 60 * 1000;

/** Días que una nota permanece en la papelera antes de borrarse definitivamente. */
export const TRASH_RETENTION_DAYS = 30;

/** Días que le quedan a una nota en la papelera (mínimo 0). */
export function daysLeftInTrash(deletedAt: number, now: number = Date.now()): number {
  const expiresAt = deletedAt + TRASH_RETENTION_DAYS * DAY_MS;
  return Math.max(0, Math.ceil((expiresAt - now) / DAY_MS));
}

/** Fecha corta y relativa para las tarjetas: "Ahora", "Hace 5 min", "Ayer", "12 mar", "12 mar 2024". */
export function formatRelativeDate(timestamp: number, now: number = Date.now()): string {
  const diff = now - timestamp;
  if (diff < 60_000) return 'Ahora';
  if (diff < 3_600_000) return `Hace ${Math.floor(diff / 60_000)} min`;

  const date = new Date(timestamp);
  const today = new Date(now);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  if (timestamp >= startOfToday) {
    return date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }
  if (timestamp >= startOfToday - DAY_MS) return 'Ayer';

  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}
