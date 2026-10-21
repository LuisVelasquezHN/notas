/**
 * Historial deshacer/rehacer genérico e inmutable.
 * Los cambios seguidos (p. ej. teclear una palabra) se agrupan en un solo paso si llegan
 * antes de `coalesceMs` desde el último, sin que un grupo dure más de `MAX_GROUP_MS`
 * (escribir sin pausa no debe convertirse en un único paso).
 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Momento del último cambio registrado (para agrupar). */
  lastChangeAt: number;
  /** Momento en que empezó el grupo actual. */
  groupStartedAt: number;
};

export const HISTORY_LIMIT = 100;
export const MAX_GROUP_MS = 3000;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastChangeAt: 0, groupStartedAt: 0 };
}

export function pushHistory<T>(
  history: History<T>,
  next: T,
  now: number = Date.now(),
  coalesceMs = 1000,
): History<T> {
  if (Object.is(next, history.present)) return history;
  const coalesce =
    history.past.length > 0 &&
    now - history.lastChangeAt < coalesceMs &&
    now - history.groupStartedAt < MAX_GROUP_MS;
  const past = coalesce ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return {
    past,
    present: next,
    future: [],
    lastChangeAt: now,
    groupStartedAt: coalesce ? history.groupStartedAt : now,
  };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    lastChangeAt: 0,
    groupStartedAt: 0,
  };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return {
    past: [...history.past, history.present],
    present: next,
    future,
    lastChangeAt: 0,
    groupStartedAt: 0,
  };
}
