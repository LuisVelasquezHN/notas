import { create } from 'zustand';

type SecurityState = {
  /** La app está bloqueada: se muestra la pantalla de desbloqueo encima de todo. */
  appLocked: boolean;
  /** Notas bloqueadas que ya se han desbloqueado en esta sesión (hasta salir de la app). */
  unlockedNoteIds: string[];
  lockApp: () => void;
  unlockApp: () => void;
  unlockNote: (id: string) => void;
  /** Vuelve a bloquear las notas abiertas (al pasar a segundo plano). */
  relockNotes: () => void;
};

/** Estado de bloqueo de la sesión (no se persiste: al abrir la app todo empieza bloqueado). */
export const useSecurityStore = create<SecurityState>()((set) => ({
  appLocked: false,
  unlockedNoteIds: [],
  lockApp: () => set({ appLocked: true, unlockedNoteIds: [] }),
  unlockApp: () => set({ appLocked: false }),
  unlockNote: (id) =>
    set((s) =>
      s.unlockedNoteIds.includes(id) ? s : { unlockedNoteIds: [...s.unlockedNoteIds, id] },
    ),
  relockNotes: () => set({ unlockedNoteIds: [] }),
}));

/** Las hojas y visores modales se ocultan mientras la app está bloqueada (quedarían encima). */
export function useAppLocked(): boolean {
  return useSecurityStore((s) => s.appLocked);
}
