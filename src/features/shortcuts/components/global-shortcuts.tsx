import { router } from 'expo-router';

import { useShortcuts } from '@/lib/use-shortcuts';

import { useShortcutsHelp } from '../store';
import { ShortcutsSheet } from './shortcuts-sheet';

/** Atajos de toda la app (web): buscar, nueva nota o lista y la ayuda. */
export function GlobalShortcuts() {
  const open = useShortcutsHelp((s) => s.open);
  const setOpen = useShortcutsHelp((s) => s.setOpen);
  useShortcuts({
    'mod+k': () => router.push('/search'),
    'alt+n': () => router.push({ pathname: '/new', params: { kind: 'text' } }),
    'alt+l': () => router.push({ pathname: '/new', params: { kind: 'checklist' } }),
    '?': () => setOpen(true),
  });
  return <ShortcutsSheet visible={open} onClose={() => setOpen(false)} />;
}
