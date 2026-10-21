import { reminderPresets, dayDiff, defaultCustomTime } from '../format';
import { groupReminders, overdueCount } from '../groups';
import { buildRecurrence } from '../recurrence';
import {
  diffWindow,
  fireAtAfterDone,
  notificationIdentifier,
  planWindow,
  reminderIdFromIdentifier,
  rolledForwardFireAt,
  upcomingFireTimes,
  type ActiveReminder,
} from '../window';
import { fromWallTime } from '../zoned-time';

const TZ = 'America/Tegucigalpa';
const wall = (day: number, hour: number, minute = 0) =>
  fromWallTime({ year: 2026, month: 9, day, hour, minute }, TZ);

const reminder = (overrides: Partial<ActiveReminder>): ActiveReminder => ({
  id: 'r1',
  noteId: 'n1',
  checklistItemId: null,
  fireAt: wall(20, 9),
  rrule: null,
  timezone: TZ,
  title: 'Nota',
  body: '',
  ...overrides,
});

describe('window', () => {
  const now = wall(19, 12);

  it('un recordatorio puntual pasado no se programa', () => {
    expect(upcomingFireTimes(reminder({ fireAt: wall(19, 9) }), now)).toEqual([]);
    expect(upcomingFireTimes(reminder({}), now)).toEqual([wall(20, 9)]);
  });

  it('un recurrente pospuesto conserva la serie', () => {
    const rrule = buildRecurrence('daily', { year: 2026, month: 9, day: 19, hour: 9, minute: 0 });
    const snoozed = reminder({ fireAt: wall(19, 12, 10), rrule });
    expect(upcomingFireTimes(snoozed, now, 3)).toEqual([
      wall(19, 12, 10),
      wall(20, 9),
      wall(21, 9),
    ]);
  });

  it('limita la ventana a las más próximas y ordena', () => {
    const rrule = buildRecurrence('daily', { year: 2026, month: 9, day: 19, hour: 9, minute: 0 });
    const planned = planWindow(
      [
        reminder({ id: 'a', fireAt: wall(19, 9), rrule }),
        reminder({ id: 'b', fireAt: wall(20, 8) }),
      ],
      now,
      4,
    );
    expect(planned.map((p) => [p.reminderId, p.fireAt])).toEqual([
      ['b', wall(20, 8)],
      ['a', wall(20, 9)],
      ['a', wall(21, 9)],
      ['a', wall(22, 9)],
    ]);
  });

  it('el identificador cambia con el contenido y permite recuperar el recordatorio', () => {
    const id = '0192f1c2-7a1b-7c3d-8e4f-001122334455';
    const a = notificationIdentifier(id, 1, 'Compra', '');
    expect(a).not.toBe(notificationIdentifier(id, 1, 'Compra!', ''));
    expect(a).toBe(notificationIdentifier(id, 1, 'Compra', ''));
    expect(reminderIdFromIdentifier(a)).toBe(id);
    expect(reminderIdFromIdentifier('otra')).toBeNull();
  });

  it('diff: cancela lo que sobra y programa lo que falta', () => {
    const planned = planWindow([reminder({})], now);
    const { cancel, schedule } = diffWindow(['viejo', planned[0].identifier], planned);
    expect(cancel).toEqual(['viejo']);
    expect(schedule).toEqual([]);
    expect(diffWindow([], planned).schedule).toHaveLength(1);
  });

  it('un recurrente vencido avanza a su última ocurrencia pasada', () => {
    const rrule = buildRecurrence('daily', { year: 2026, month: 9, day: 15, hour: 9, minute: 0 });
    expect(rolledForwardFireAt(reminder({ fireAt: wall(15, 9), rrule }), now)).toBe(wall(19, 9));
    expect(rolledForwardFireAt(reminder({ fireAt: wall(19, 9), rrule }), now)).toBeNull();
    expect(rolledForwardFireAt(reminder({ fireAt: wall(15, 9) }), now)).toBeNull();
  });

  it('marcar como hecho pasa a la siguiente ocurrencia', () => {
    const rrule = buildRecurrence('daily', { year: 2026, month: 9, day: 19, hour: 9, minute: 0 });
    expect(fireAtAfterDone(reminder({ fireAt: wall(19, 9), rrule }), now)).toBe(wall(20, 9));
    // Hecho por adelantado: se salta la ocurrencia de mañana.
    expect(fireAtAfterDone(reminder({ fireAt: wall(20, 9), rrule }), now)).toBe(wall(21, 9));
    expect(fireAtAfterDone(reminder({}), now)).toBeNull();
  });
});

describe('format', () => {
  it('atajos según la hora', () => {
    const morning = new Date(2026, 9, 19, 10).getTime(); // lunes
    expect(reminderPresets(morning).map((p) => p.key)).toEqual([
      'afternoon',
      'tomorrow',
      'nextWeek',
    ]);
    const nextWeek = reminderPresets(morning).find((p) => p.key === 'nextWeek')!;
    expect(new Date(nextWeek.at)).toEqual(new Date(2026, 9, 26, 9));
    const late = new Date(2026, 9, 19, 21).getTime();
    expect(reminderPresets(late).map((p) => p.key)).toEqual(['tomorrow', 'nextWeek']);
  });

  it('diferencia de días y hora por defecto', () => {
    const now = new Date(2026, 9, 19, 23, 50).getTime();
    expect(dayDiff(new Date(2026, 9, 20, 0, 5).getTime(), now)).toBe(1);
    expect(defaultCustomTime(new Date(2026, 9, 19, 10, 40).getTime())).toBe(
      new Date(2026, 9, 19, 12).getTime(),
    );
  });
});

describe('groups', () => {
  it('agrupa en vencidos, hoy, mañana, semana y más adelante', () => {
    const now = new Date(2026, 9, 19, 12).getTime();
    const rows = [
      new Date(2026, 9, 18, 9),
      new Date(2026, 9, 19, 12),
      new Date(2026, 9, 19, 18),
      new Date(2026, 9, 20, 9),
      new Date(2026, 9, 24, 9),
      new Date(2026, 10, 2, 9),
    ].map((d) => ({ fireAt: d.getTime() }));
    expect(groupReminders(rows, now).map((g) => [g.group, g.items.length])).toEqual([
      ['overdue', 2],
      ['today', 1],
      ['tomorrow', 1],
      ['week', 1],
      ['later', 1],
    ]);
    expect(overdueCount(rows, now)).toBe(2);
  });
});
