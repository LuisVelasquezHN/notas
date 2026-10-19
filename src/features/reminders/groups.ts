import { dayDiff } from './format';

export const REMINDER_GROUPS = ['overdue', 'today', 'tomorrow', 'week', 'later'] as const;
export type ReminderGroup = (typeof REMINDER_GROUPS)[number];

export const REMINDER_GROUP_LABELS: Record<ReminderGroup, string> = {
  overdue: 'Vencidos',
  today: 'Hoy',
  tomorrow: 'Mañana',
  week: 'Próximos 7 días',
  later: 'Más adelante',
};

export function reminderGroup(fireAt: number, now: number): ReminderGroup {
  if (fireAt <= now) return 'overdue';
  const diff = dayDiff(fireAt, now);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff < 7) return 'week';
  return 'later';
}

/** Agrupa (manteniendo el orden) en vencidos, hoy, mañana, esta semana y más adelante. */
export function groupReminders<T extends { fireAt: number }>(
  rows: T[],
  now: number,
): { group: ReminderGroup; items: T[] }[] {
  const map = new Map<ReminderGroup, T[]>();
  for (const row of rows) {
    const group = reminderGroup(row.fireAt, now);
    const list = map.get(group);
    if (list) list.push(row);
    else map.set(group, [row]);
  }
  return REMINDER_GROUPS.filter((g) => map.has(g)).map((group) => ({
    group,
    items: map.get(group)!,
  }));
}

/** Número de recordatorios vencidos (badge del icono y de la pestaña). */
export function overdueCount(rows: { fireAt: number }[], now: number): number {
  return rows.filter((r) => r.fireAt <= now).length;
}
