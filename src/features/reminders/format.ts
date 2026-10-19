import { DAY_MS } from '@/lib/dates';

/** Minutos de "Posponer" desde la notificación. */
export const SNOOZE_MINUTES = 10;

const startOfDay = (t: number) => {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Días naturales entre dos instantes (hora local): 0 = mismo día, 1 = mañana, −1 = ayer. */
export function dayDiff(timestamp: number, now: number): number {
  return Math.round((startOfDay(timestamp) - startOfDay(now)) / DAY_MS);
}

export function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** Día del recordatorio: "Hoy", "Mañana", "Ayer", "lun 21 oct" o "21 oct 2027". */
export function formatReminderDay(timestamp: number, now: number = Date.now()): string {
  const diff = dayDiff(timestamp, now);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  const date = new Date(timestamp);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date
    .toLocaleDateString('es', {
      ...(diff > 0 && diff <= 7 ? { weekday: 'short' } : {}),
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    })
    .replace(/\./g, '')
    .replace(',', '');
}

/** "Hoy, 18:00" · "Mañana, 09:00" · "lun 21 oct, 09:00". */
export function formatReminder(timestamp: number, now: number = Date.now()): string {
  return `${formatReminderDay(timestamp, now)}, ${formatTime(timestamp)}`;
}

export type ReminderPreset = { key: string; label: string; at: number };

const at = (base: number, dayOffset: number, hour: number, minute = 0) => {
  const d = new Date(base);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, hour, minute).getTime();
};

/**
 * Atajos del selector: "Esta tarde" (18:00) o "Esta noche" (20:00) si aún da tiempo, "Mañana"
 * (9:00) y "Próxima semana" (lunes, 9:00).
 */
export function reminderPresets(now: number = Date.now()): ReminderPreset[] {
  const presets: ReminderPreset[] = [];
  const hour = new Date(now).getHours();
  if (hour < 17) presets.push({ key: 'afternoon', label: 'Esta tarde', at: at(now, 0, 18) });
  else if (hour < 19) presets.push({ key: 'evening', label: 'Esta noche', at: at(now, 0, 20) });
  presets.push({ key: 'tomorrow', label: 'Mañana', at: at(now, 1, 9) });
  const weekday = new Date(now).getDay(); // 0 = domingo
  const untilMonday = (8 - weekday) % 7 || 7;
  presets.push({ key: 'nextWeek', label: 'Próxima semana', at: at(now, untilMonday, 9) });
  return presets;
}

/** Hora inicial del selector personalizado: la próxima hora en punto (al menos 30 min después). */
export function defaultCustomTime(now: number = Date.now()): number {
  const d = new Date(now + 30 * 60_000);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.getTime();
}
