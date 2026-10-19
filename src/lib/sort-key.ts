import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';

/**
 * Claves de orden manual (fractional indexing): mover un elemento solo reescribe su propia fila,
 * lo que evita renumerar listas enteras y conflictos al sincronizar.
 * `null` significa "sin vecino" por ese lado.
 */
export function sortKeyBetween(before: string | null, after: string | null): string {
  return generateKeyBetween(before, after);
}

export function sortKeyAfter(last: string | null): string {
  return generateKeyBetween(last, null);
}

export function sortKeyBefore(first: string | null): string {
  return generateKeyBetween(null, first);
}

export function sortKeysBetween(before: string | null, after: string | null, n: number): string[] {
  return generateNKeysBetween(before, after, n);
}

/**
 * Clave para mover un elemento entre dos vecinos. Tolera vecinos con la misma clave o desordenados
 * (no debería pasar, pero una clave repetida no puede bloquear el arrastre): entonces lo coloca
 * justo antes del siguiente.
 */
export function sortKeyForMove(before: string | null, after: string | null): string {
  if (before !== null && after !== null && before >= after) return generateKeyBetween(null, after);
  return generateKeyBetween(before, after);
}
