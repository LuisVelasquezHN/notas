import { DAY_MS, daysLeftInTrash, formatRelativeDate } from '../dates';

describe('dates', () => {
  const now = new Date(2026, 9, 18, 15, 0).getTime();

  it('calcula los días restantes en la papelera', () => {
    expect(daysLeftInTrash(now, now)).toBe(30);
    expect(daysLeftInTrash(now - 29.5 * DAY_MS, now)).toBe(1);
    expect(daysLeftInTrash(now - 40 * DAY_MS, now)).toBe(0);
  });

  it('formatea fechas relativas', () => {
    expect(formatRelativeDate(now - 10_000, now)).toBe('Ahora');
    expect(formatRelativeDate(now - 5 * 60_000, now)).toBe('Hace 5 min');
    expect(formatRelativeDate(new Date(2026, 9, 17, 20, 0).getTime(), now)).toBe('Ayer');
    expect(formatRelativeDate(new Date(2025, 2, 1).getTime(), now)).toMatch(/2025/);
  });
});
