import { latestOccurrenceBetween, nextOccurrence, occurrencesAfter } from './recurrence';

/**
 * Planificación de la ventana de notificaciones (PLAN.md §6). iOS admite como mucho 64
 * notificaciones locales pendientes: se programan las ~50 más próximas y se recalcula la ventana
 * con cada cambio, al volver a primer plano y en segundo plano.
 *
 * Todo es puro y determinista: el identificador de cada notificación depende del recordatorio, la
 * hora y el contenido, así que reprogramar es idempotente (solo se tocan las que cambian).
 */

export const WINDOW_SIZE = 50;
/** Ocurrencias futuras de un mismo recordatorio recurrente dentro de la ventana. */
export const MAX_OCCURRENCES_PER_REMINDER = 10;

export type ActiveReminder = {
  id: string;
  noteId: string;
  checklistItemId: string | null;
  fireAt: number;
  rrule: string | null;
  timezone: string;
  /** Título de la notificación (título de la nota o texto del ítem). */
  title: string;
  body: string;
};

export type PlannedNotification = {
  identifier: string;
  reminderId: string;
  noteId: string;
  fireAt: number;
  title: string;
  body: string;
};

/** Hash corto y estable del contenido (djb2). */
function hash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function notificationIdentifier(
  reminderId: string,
  fireAt: number,
  title: string,
  body: string,
) {
  return `reminder_${reminderId}_${fireAt}_${hash(`${title}\n${body}`)}`;
}

/** ID del recordatorio a partir del identificador de su notificación. */
export function reminderIdFromIdentifier(identifier: string): string | null {
  const m = /^reminder_(.+)_(\d+)_[0-9a-z]+$/.exec(identifier);
  return m ? m[1] : null;
}

/** Próximos avisos (posteriores a `now`) de un recordatorio. */
export function upcomingFireTimes(
  reminder: Pick<ActiveReminder, 'fireAt' | 'rrule' | 'timezone'>,
  now: number,
  limit = MAX_OCCURRENCES_PER_REMINDER,
): number[] {
  const times: number[] = [];
  if (reminder.fireAt > now) times.push(reminder.fireAt);
  if (reminder.rrule) {
    // Tras el aviso actual (que puede ser una hora pospuesta) siguen las ocurrencias de la serie.
    const after = Math.max(reminder.fireAt, now);
    for (const t of occurrencesAfter(reminder.rrule, reminder.timezone, after, limit)) {
      if (!times.includes(t)) times.push(t);
    }
  }
  return times.slice(0, limit);
}

/** Las `size` notificaciones más próximas de todos los recordatorios activos. */
export function planWindow(
  reminders: ActiveReminder[],
  now: number,
  size = WINDOW_SIZE,
): PlannedNotification[] {
  const all: PlannedNotification[] = [];
  for (const reminder of reminders) {
    for (const fireAt of upcomingFireTimes(reminder, now)) {
      all.push({
        identifier: notificationIdentifier(reminder.id, fireAt, reminder.title, reminder.body),
        reminderId: reminder.id,
        noteId: reminder.noteId,
        fireAt,
        title: reminder.title,
        body: reminder.body,
      });
    }
  }
  return all.sort((a, b) => a.fireAt - b.fireAt).slice(0, size);
}

/** Qué cancelar y qué programar para pasar de lo que hay programado a lo planificado. */
export function diffWindow(scheduledIds: string[], planned: PlannedNotification[]) {
  const plannedIds = new Set(planned.map((p) => p.identifier));
  const existing = new Set(scheduledIds);
  return {
    cancel: scheduledIds.filter((id) => !plannedIds.has(id)),
    schedule: planned.filter((p) => !existing.has(p.identifier)),
  };
}

/**
 * Un recurrente vencido avanza a su ocurrencia más reciente ya pasada: en "vencidos" se ve el
 * último aviso pendiente, no el primero. Devuelve el nuevo `fire_at` o `null` si no cambia.
 */
export function rolledForwardFireAt(
  reminder: Pick<ActiveReminder, 'fireAt' | 'rrule' | 'timezone'>,
  now: number,
): number | null {
  if (!reminder.rrule || reminder.fireAt >= now) return null;
  return latestOccurrenceBetween(reminder.rrule, reminder.timezone, reminder.fireAt, now);
}

/**
 * `fire_at` tras marcar como hecho: la siguiente ocurrencia (después de ahora y del aviso actual)
 * o `null` si no es recurrente o la serie ha terminado.
 */
export function fireAtAfterDone(
  reminder: Pick<ActiveReminder, 'fireAt' | 'rrule' | 'timezone'>,
  now: number,
): number | null {
  if (!reminder.rrule) return null;
  return nextOccurrence(reminder.rrule, reminder.timezone, Math.max(now, reminder.fireAt));
}
