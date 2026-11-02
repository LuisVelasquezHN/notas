import { useEffect, useRef } from 'react';

/**
 * Atajos de teclado en web. Las claves son combinaciones como `mod+z`, `mod+shift+z`, `alt+n`,
 * `escape` o `?` (`mod` = Cmd en Mac y Ctrl en el resto).
 *
 * - Dentro del editor (TipTap) no actúan: allí los atajos los gestiona el editor.
 * - Con el foco en un campo de texto solo actúan los que llevan `mod`/`alt` o `escape` (escribir
 *   una letra no dispara nada).
 */
export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function comboOf(event: KeyboardEvent): string {
  const mod = isMac() ? event.metaKey : event.ctrlKey;
  // "?" está en teclas distintas según el teclado: se mira el carácter (y Mayús + "/" en el de EE. UU.).
  if ((event.key === '?' || (event.code === 'Slash' && event.shiftKey)) && !mod && !event.altKey) {
    return '?';
  }
  // Letras y números por la tecla física: con Alt en Mac `key` da otros caracteres (˜, ¬…).
  const code = event.code ?? '';
  const key = code.startsWith('Key')
    ? code.slice(3).toLowerCase()
    : code.startsWith('Digit')
      ? code.slice(5)
      : event.key.toLowerCase();
  return [mod && 'mod', event.altKey && 'alt', event.shiftKey && 'shift', key]
    .filter(Boolean)
    .join('+');
}

export function useShortcuts(shortcuts: ShortcutMap, enabled = true) {
  const latest = useRef(shortcuts);
  useEffect(() => {
    latest.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.('.ProseMirror')) return;
      const typing =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      const combo = comboOf(event);
      const handler = latest.current[combo];
      if (!handler) return;
      if (typing && !combo.startsWith('mod') && !combo.startsWith('alt') && combo !== 'escape') {
        return;
      }
      event.preventDefault();
      handler(event);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
