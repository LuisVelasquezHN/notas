/**
 * Vecinos de un elemento tras soltarlo en la posición `toIndex` de `ordered` (el orden nuevo).
 * La nota movida recibe una clave entre las de sus vecinas (`null` = extremo de la lista).
 */
export function neighborKeys<T extends { sortKey: string }>(
  ordered: readonly T[],
  toIndex: number,
): { before: string | null; after: string | null } {
  return {
    before: toIndex > 0 ? ordered[toIndex - 1].sortKey : null,
    after: toIndex < ordered.length - 1 ? ordered[toIndex + 1].sortKey : null,
  };
}

/** Las ancladas se reordenan entre sí y el resto entre sí: nunca se cruza la frontera. */
export function splitPinned<T extends { isPinned: boolean }>(notes: readonly T[]) {
  return {
    pinned: notes.filter((n) => n.isPinned),
    others: notes.filter((n) => !n.isPinned),
  };
}
