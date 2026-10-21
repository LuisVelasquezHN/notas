import { create } from 'zustand';

import { t } from '@/i18n';

export type SnackbarAction = { label: string; onPress: () => void | Promise<void> };

export type SnackbarMessage = {
  id: number;
  message: string;
  action?: SnackbarAction;
};

/** Duración por defecto: suficiente para pulsar "Deshacer". */
export const SNACKBAR_DURATION_MS = 4500;

type SnackbarState = {
  current: SnackbarMessage | null;
  show: (message: string, action?: SnackbarAction) => void;
  dismiss: (id?: number) => void;
};

let nextId = 1;

export const useSnackbarStore = create<SnackbarState>()((set, get) => ({
  current: null,
  show: (message, action) => set({ current: { id: nextId++, message, action } }),
  // Con `id`, solo cierra ese mensaje (evita que un temporizador viejo cierre uno nuevo).
  dismiss: (id) => {
    if (id === undefined || get().current?.id === id) set({ current: null });
  },
}));

/** Atajo fuera de React: `showSnackbar('Nota archivada', { label: 'Deshacer', onPress })`. */
export function showSnackbar(message: string, action?: SnackbarAction) {
  useSnackbarStore.getState().show(message, action);
}

export function showUndo(message: string, undo: () => void | Promise<void>) {
  showSnackbar(message, { label: t('common.undo'), onPress: undo });
}
