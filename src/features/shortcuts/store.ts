import { create } from 'zustand';

/** Hoja de ayuda de los atajos de teclado (se abre con "?" o desde Ajustes). */
export const useShortcutsHelp = create<{ open: boolean; setOpen: (open: boolean) => void }>()(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);
