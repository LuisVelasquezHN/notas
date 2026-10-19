/**
 * Conversión entre instantes (ms UTC) y "hora de pared" en una zona IANA. Los recordatorios
 * recurrentes se calculan en hora local de su zona: "cada día a las 9:00" sigue siendo a las 9:00
 * después de un cambio de horario.
 */

export type WallTime = {
  year: number;
  /** 0–11, como `Date`. */
  month: number;
  day: number;
  hour: number;
  minute: number;
};

/** Zona horaria del dispositivo ("America/Tegucigalpa"…). */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

function formatterFor(timeZone: string): Intl.DateTimeFormat | null {
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat('en-US', {
          timeZone,
          hourCycle: 'h23',
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
        }),
      );
    } catch {
      // Zona desconocida: se usa la del dispositivo.
      formatters.set(timeZone, null);
    }
  }
  return formatters.get(timeZone) ?? null;
}

/** Hora de pared de un instante en la zona dada. */
export function toWallTime(epoch: number, timeZone: string): WallTime {
  const formatter = formatterFor(timeZone);
  if (!formatter) {
    const d = new Date(epoch);
    return {
      year: d.getFullYear(),
      month: d.getMonth(),
      day: d.getDate(),
      hour: d.getHours(),
      minute: d.getMinutes(),
    };
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(epoch))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month - 1,
    day: parts.day,
    // Algunos motores devuelven "24" a medianoche.
    hour: parts.hour % 24,
    minute: parts.minute,
  };
}

const wallToUtc = (w: WallTime) => Date.UTC(w.year, w.month, w.day, w.hour, w.minute);

/** Desfase de la zona (ms) en ese instante: hora de pared − UTC. */
function offsetAt(epoch: number, timeZone: string): number {
  const wall = toWallTime(epoch, timeZone);
  const seconds = new Date(epoch).getUTCSeconds() * 1000 + new Date(epoch).getUTCMilliseconds();
  return wallToUtc(wall) + seconds - epoch;
}

/**
 * Instante de una hora de pared en la zona dada. Si la hora no existe (salto de primavera) se
 * desplaza hacia delante; si existe dos veces (otoño) se toma la primera.
 */
export function fromWallTime(wall: WallTime, timeZone: string): number {
  if (!formatterFor(timeZone)) {
    return new Date(wall.year, wall.month, wall.day, wall.hour, wall.minute).getTime();
  }
  const guess = wallToUtc(wall);
  const first = guess - offsetAt(guess, timeZone);
  const second = guess - offsetAt(first, timeZone);
  if (first === second) return first;
  // Cambio de horario entre medias: la que conserve la hora pedida (o la más temprana).
  const matches = [first, second].filter((t) => wallToUtc(toWallTime(t, timeZone)) === guess);
  return matches.length > 0 ? Math.min(...matches) : Math.max(first, second);
}

/**
 * Representación "UTC falsa" de una hora de pared: la librería rrule trabaja en UTC, así que se le
 * pasan las horas de pared como si fueran UTC y luego se convierten con `fromFakeUtc`.
 */
export function toFakeUtc(epoch: number, timeZone: string): Date {
  return new Date(wallToUtc(toWallTime(epoch, timeZone)));
}

export function fromFakeUtc(date: Date, timeZone: string): number {
  return fromWallTime(
    {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
    },
    timeZone,
  );
}
