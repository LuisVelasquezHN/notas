/**
 * Atajos de teclado que muestra la ayuda. Los de formato son los de TipTap (y los propios de
 * `tiptap-dom.tsx`); los generales, los de `GlobalShortcuts`.
 */
export type ShortcutHelp = { keys: string[]; label: string };

export const GENERAL_SHORTCUTS = [
  { keys: ['mod', 'K'], label: 'search' },
  { keys: ['alt', 'N'], label: 'newNote' },
  { keys: ['alt', 'L'], label: 'newList' },
  { keys: ['?'], label: 'help' },
  { keys: ['Esc'], label: 'back' },
] as const;

export const EDITOR_SHORTCUTS = [
  { keys: ['mod', 'Z'], label: 'undo' },
  { keys: ['mod', 'shift', 'Z'], label: 'redo' },
  { keys: ['mod', 'S'], label: 'save' },
  { keys: ['mod', 'B'], label: 'bold' },
  { keys: ['mod', 'I'], label: 'italic' },
  { keys: ['mod', 'U'], label: 'underline' },
  { keys: ['mod', 'shift', 'S'], label: 'strike' },
  { keys: ['mod', 'shift', 'E'], label: 'important' },
  { keys: ['mod', 'shift', 'H'], label: 'highlight' },
  { keys: ['mod', 'alt', '1'], label: 'heading1' },
  { keys: ['mod', 'alt', '2'], label: 'heading2' },
  { keys: ['mod', 'shift', '8'], label: 'bulletList' },
  { keys: ['mod', 'shift', '7'], label: 'orderedList' },
  { keys: ['mod', 'shift', '9'], label: 'taskList' },
  { keys: ['mod', 'shift', 'B'], label: 'blockquote' },
  { keys: ['mod', 'E'], label: 'code' },
] as const;

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

/** Nombre de cada tecla para mostrarla (⌘/⌥/⇧ en Mac, Ctrl/Alt/Mayús en el resto). */
export function keyLabel(key: string, shiftLabel: string): string {
  const mac = isMac();
  if (key === 'mod') return mac ? '⌘' : 'Ctrl';
  if (key === 'alt') return mac ? '⌥' : 'Alt';
  if (key === 'shift') return mac ? '⇧' : shiftLabel;
  return key;
}
