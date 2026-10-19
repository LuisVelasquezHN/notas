/** Palabras de la búsqueda, sin comillas ni espacios sobrantes. */
export function searchTerms(query: string): string[] {
  return query
    .replace(/["*]/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

/**
 * Expresión MATCH de FTS5: cada palabra entre comillas (sin operadores accidentales) y con prefijo,
 * para que "rec" encuentre "receta". Todas las palabras deben aparecer (AND implícito).
 */
export function buildFtsMatch(query: string): string | null {
  const terms = searchTerms(query);
  if (terms.length === 0) return null;
  return terms.map((t) => `"${t}"*`).join(' ');
}

/** Patrón LIKE con `%` y `_` escapados (se usa con `ESCAPE '\'`). */
export function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
