import {
  buildRecurrence,
  latestOccurrenceBetween,
  nextOccurrence,
  occurrencesAfter,
  parseRecurrence,
  recurrenceKind,
  recurrenceLabel,
} from '../recurrence';
import { fromWallTime, toWallTime } from '../zoned-time';

const MADRID = 'Europe/Madrid';
const HONDURAS = 'America/Tegucigalpa'; // UTC−6, sin horario de verano

describe('zoned-time', () => {
  it('convierte hora de pared ↔ instante en una zona sin cambios de horario', () => {
    const t = fromWallTime({ year: 2026, month: 9, day: 19, hour: 9, minute: 0 }, HONDURAS);
    expect(new Date(t).toISOString()).toBe('2026-10-19T15:00:00.000Z');
    expect(toWallTime(t, HONDURAS)).toEqual({
      year: 2026,
      month: 9,
      day: 19,
      hour: 9,
      minute: 0,
    });
  });

  it('respeta el horario de verano', () => {
    const summer = fromWallTime({ year: 2026, month: 6, day: 1, hour: 9, minute: 0 }, MADRID);
    const winter = fromWallTime({ year: 2026, month: 11, day: 1, hour: 9, minute: 0 }, MADRID);
    expect(new Date(summer).toISOString()).toBe('2026-07-01T07:00:00.000Z');
    expect(new Date(winter).toISOString()).toBe('2026-12-01T08:00:00.000Z');
  });

  it('una hora inexistente (salto de primavera) se desplaza hacia delante', () => {
    // 29 mar 2026: en Madrid se pasa de 02:00 a 03:00.
    const t = fromWallTime({ year: 2026, month: 2, day: 29, hour: 2, minute: 30 }, MADRID);
    expect(toWallTime(t, MADRID).hour).toBe(3);
  });
});

describe('recurrence', () => {
  const start = { year: 2026, month: 9, day: 19, hour: 9, minute: 0 }; // lunes

  it('construye y reconoce cada tipo', () => {
    for (const kind of ['daily', 'weekdays', 'weekly', 'monthly', 'yearly'] as const) {
      const text = buildRecurrence(kind, start);
      expect(recurrenceKind(text)).toBe(kind);
      expect(parseRecurrence(text)?.start).toEqual(start);
    }
    expect(buildRecurrence('none', start)).toBeNull();
    expect(recurrenceKind(null)).toBe('none');
    expect(recurrenceKind('basura')).toBe('none');
  });

  it('calcula las siguientes ocurrencias diarias', () => {
    const text = buildRecurrence('daily', start)!;
    const from = fromWallTime({ ...start, hour: 10 }, HONDURAS);
    const next = occurrencesAfter(text, HONDURAS, from, 3).map((t) => toWallTime(t, HONDURAS));
    expect(next.map((w) => [w.day, w.hour])).toEqual([
      [20, 9],
      [21, 9],
      [22, 9],
    ]);
  });

  it('inclusive devuelve la propia hora si coincide', () => {
    const text = buildRecurrence('daily', start)!;
    const t = fromWallTime(start, HONDURAS);
    expect(nextOccurrence(text, HONDURAS, t, true)).toBe(t);
    expect(nextOccurrence(text, HONDURAS, t)).toBe(t + 24 * 3600_000);
  });

  it('de lunes a viernes salta el fin de semana', () => {
    const text = buildRecurrence('weekdays', start)!;
    const friday = fromWallTime({ ...start, day: 23, hour: 10 }, HONDURAS);
    const next = toWallTime(nextOccurrence(text, HONDURAS, friday)!, HONDURAS);
    expect(next.day).toBe(26); // lunes
  });

  it('mantiene la hora local al cambiar el horario', () => {
    const text = buildRecurrence('daily', { year: 2026, month: 9, day: 20, hour: 9, minute: 0 })!;
    // 25 oct 2026: fin del horario de verano en Madrid.
    const from = fromWallTime({ year: 2026, month: 9, day: 24, hour: 12, minute: 0 }, MADRID);
    const [a, b] = occurrencesAfter(text, MADRID, from, 2);
    expect(toWallTime(a, MADRID).hour).toBe(9);
    expect(toWallTime(b, MADRID).hour).toBe(9);
    expect(b - a).toBe(24 * 3600_000);
  });

  it('última ocurrencia en un intervalo', () => {
    const text = buildRecurrence('daily', start)!;
    const first = fromWallTime(start, HONDURAS);
    const now = fromWallTime({ ...start, day: 22, hour: 8 }, HONDURAS);
    const latest = latestOccurrenceBetween(text, HONDURAS, first, now)!;
    expect(toWallTime(latest, HONDURAS).day).toBe(21);
    expect(latestOccurrenceBetween(text, HONDURAS, latest, latest + 3600_000)).toBeNull();
  });

  it('etiquetas legibles', () => {
    expect(recurrenceLabel('weekly', start)).toBe('Cada semana, el lunes');
    expect(recurrenceLabel('monthly', start)).toBe('Cada mes, el día 19');
    expect(recurrenceLabel('yearly', start)).toBe('Cada año, el 19 de octubre');
  });
});
