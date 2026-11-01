/**
 * Resaltado de las palabras buscadas en las tarjetas de resultados. Sin distinguir mayúsculas ni
 * tildes (como la búsqueda: "cancion" encuentra "Canción").
 */

export type Segment = { text: string; match: boolean };

/** Un carácter sin tilde y en minúscula; si cambiaría de longitud, se deja tal cual. */
function foldChar(c: string): string {
  const folded = c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (folded.length === 1) return folded;
  const lower = c.toLowerCase();
  return lower.length === 1 ? lower : c;
}

/** Texto plegado con la misma longitud que el original (los índices coinciden). */
export function foldText(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) out += foldChar(text[i]);
  return out;
}

/** Marca de cada carácter: si forma parte de alguna de las palabras. */
function matchMask(text: string, terms: string[]): boolean[] | null {
  const needles = [...new Set(terms.map(foldText).filter(Boolean))];
  if (needles.length === 0) return null;
  const folded = foldText(text);
  const mask = new Array<boolean>(text.length).fill(false);
  let any = false;
  for (const needle of needles) {
    let at = folded.indexOf(needle);
    while (at !== -1) {
      any = true;
      mask.fill(true, at, at + needle.length);
      at = folded.indexOf(needle, at + needle.length);
    }
  }
  return any ? mask : null;
}

/** Trozos de texto alternando lo normal y lo que coincide con alguna palabra. */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const mask = matchMask(text, terms);
  if (!mask) return text ? [{ text, match: false }] : [];
  const segments: Segment[] = [];
  let start = 0;
  for (let i = 1; i <= text.length; i++) {
    if (i === text.length || mask[i] !== mask[start]) {
      segments.push({ text: text.slice(start, i), match: mask[start] });
      start = i;
    }
  }
  return segments;
}

/**
 * Fragmento del texto que empieza cerca de la primera coincidencia (con `context` caracteres
 * antes), para que se vea en la tarjeta aunque esté al final de una nota larga.
 */
export function matchSnippet(text: string, terms: string[], context = 40): string {
  const mask = matchMask(text, terms);
  const first = mask ? mask.indexOf(true) : -1;
  if (first <= context) return text;
  let start = first - context;
  // Desde el principio de una palabra (o de una línea).
  const breakAt = text.slice(start, first).search(/[\s]/);
  if (breakAt !== -1) start += breakAt + 1;
  return `…${text.slice(start)}`;
}
