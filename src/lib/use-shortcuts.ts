/**
 * Atajos de teclado de la app (solo web; ver `use-shortcuts.web.ts`). En iOS/Android, con teclado
 * físico, los del editor los recoge el propio editor (webview).
 */
export type ShortcutMap = Record<string, (event: KeyboardEvent) => void>;

export function useShortcuts(_shortcuts: ShortcutMap, _enabled = true) {}
