import { RRule } from 'rrule';

import { currentLocale, t, type TFunction } from '@/i18n';

import { fromFakeUtc, toFakeUtc, type WallTime } from './zoned-time';

/**
 * Recurrencias. En `reminders.rrule` se guarda un texto RFC 5545 con el inicio en hora de pared
 * (sin zona: la zona es `reminders.timezone`):
 *
 *   DTSTART:20261019T090000
 *   RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR
 *
 * El inicio es el ancla de las ocurrencias; `fire_at` es solo el próximo aviso (puede ser una
 * hora pospuesta), así que posponer no desplaza la serie.
 */

export const RECURRENCE_KINDS = [
  'none',
  'daily',
  'weekdays',
  'weekly',
  'monthly',
  'yearly',
] as const;
export type RecurrenceKind = (typeof RECURRENCE_KINDS)[number];

const pad = (n: number, size = 2) => String(n).padStart(size, '0');

function formatDtstart(wall: WallTime) {
  return `${pad(wall.year, 4)}${pad(wall.month + 1)}${pad(wall.day)}T${pad(wall.hour)}${pad(wall.minute)}00`;
}

function parseDtstart(value: string): WallTime | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/.exec(value.trim());
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: Number(m[2]) - 1,
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
  };
}

const RULES: Record<Exclude<RecurrenceKind, 'none'>, string> = {
  daily: 'FREQ=DAILY',
  weekdays: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  weekly: 'FREQ=WEEKLY',
  monthly: 'FREQ=MONTHLY',
  yearly: 'FREQ=YEARLY',
};

/** Texto a guardar para una recurrencia que empieza en `start` (hora de pared). */
export function buildRecurrence(kind: RecurrenceKind, start: WallTime): string | null {
  if (kind === 'none') return null;
  return `DTSTART:${formatDtstart(start)}\nRRULE:${RULES[kind]}`;
}

type ParsedRecurrence = { start: WallTime; rule: string };

export function parseRecurrence(text: string | null | undefined): ParsedRecurrence | null {
  if (!text) return null;
  let start: WallTime | null = null;
  let rule: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const [key, ...rest] = line.split(':');
    const value = rest.join(':');
    if (key.trim().toUpperCase() === 'DTSTART') start = parseDtstart(value);
    else if (key.trim().toUpperCase() === 'RRULE') rule = value.trim();
  }
  return start && rule ? { start, rule } : null;
}

/** Tipo de recurrencia de un texto guardado (`'none'` si no se reconoce o no hay). */
export function recurrenceKind(text: string | null | undefined): RecurrenceKind {
  const parsed = parseRecurrence(text);
  if (!parsed) return 'none';
  const rule = parsed.rule.toUpperCase();
  const match = (Object.keys(RULES) as (keyof typeof RULES)[]).find((k) => RULES[k] === rule);
  return match ?? 'none';
}

function toRRule(parsed: ParsedRecurrence): RRule | null {
  try {
    const options = RRule.parseString(parsed.rule);
    const { year, month, day, hour, minute } = parsed.start;
    return new RRule({ ...options, dtstart: new Date(Date.UTC(year, month, day, hour, minute)) });
  } catch {
    return null;
  }
}

/**
 * Primera ocurrencia posterior a `after` (o igual, con `inclusive`). `null` si la serie terminó o
 * la regla no es válida.
 */
export function nextOccurrence(
  text: string,
  timeZone: string,
  after: number,
  inclusive = false,
): number | null {
  const parsed = parseRecurrence(text);
  const rule = parsed && toRRule(parsed);
  if (!rule) return null;
  // `after` puede caer entre dos minutos: se compara con la hora de pared truncada.
  const next = rule.after(toFakeUtc(after, timeZone), true);
  if (!next) return null;
  let at = fromFakeUtc(next, timeZone);
  if (at < after || (!inclusive && at === after)) {
    const following = rule.after(next, false);
    if (!following) return null;
    at = fromFakeUtc(following, timeZone);
  }
  return at;
}

/** Ocurrencias posteriores a `after`, como máximo `limit`. */
export function occurrencesAfter(
  text: string,
  timeZone: string,
  after: number,
  limit: number,
): number[] {
  const result: number[] = [];
  let cursor = after;
  while (result.length < limit) {
    const next = nextOccurrence(text, timeZone, cursor);
    if (next === null) break;
    result.push(next);
    cursor = next;
  }
  return result;
}

/** Última ocurrencia en `(from, to]`, o `null` si no hay ninguna en ese intervalo. */
export function latestOccurrenceBetween(
  text: string,
  timeZone: string,
  from: number,
  to: number,
): number | null {
  const parsed = parseRecurrence(text);
  const rule = parsed && toRRule(parsed);
  if (!rule) return null;
  const before = rule.before(toFakeUtc(to, timeZone), true);
  if (!before) return null;
  const at = fromFakeUtc(before, timeZone);
  return at > from && at <= to ? at : null;
}

/** Etiqueta de una recurrencia para una fecha de inicio: "Cada semana, el lunes". */
export function recurrenceLabel(kind: RecurrenceKind, start: WallTime, tr: TFunction = t): string {
  const date = new Date(Date.UTC(start.year, start.month, start.day));
  const format = (options: Intl.DateTimeFormatOptions) =>
    date.toLocaleDateString(currentLocale(), { ...options, timeZone: 'UTC' });
  switch (kind) {
    case 'none':
      return tr('recurrence.none');
    case 'daily':
      return tr('recurrence.daily');
    case 'weekdays':
      return tr('recurrence.weekdays');
    case 'weekly':
      return tr('recurrence.weekly', { weekday: format({ weekday: 'long' }) });
    case 'monthly':
      return tr('recurrence.monthly', { day: start.day });
    case 'yearly':
      return tr('recurrence.yearly', { date: format({ day: 'numeric', month: 'long' }) });
  }
}

/** Etiqueta corta (tarjetas y lista de recordatorios). */
export function recurrenceShortLabel(kind: RecurrenceKind, tr: TFunction = t): string {
  return kind === 'none' ? '' : tr(`recurrence.short.${kind}`);
}
