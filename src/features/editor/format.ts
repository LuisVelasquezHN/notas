/**
 * Formatos del editor enriquecido. Lo comparten el DOM component de TipTap (que los aplica) y la
 * barra de formato nativa (que los muestra): solo valores serializables, sin dependencias.
 */
export const FORMAT_COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'heading1',
  'heading2',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'code',
  'clear',
] as const;

export type FormatCommand = (typeof FORMAT_COMMANDS)[number];

/** Formatos activos en la selección actual (`clear` no tiene estado). */
export type FormatState = Partial<Record<Exclude<FormatCommand, 'clear'>, boolean>>;

export function sameFormatState(a: FormatState, b: FormatState): boolean {
  return FORMAT_COMMANDS.every((c) => c === 'clear' || !!a[c] === !!b[c]);
}
