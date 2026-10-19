import { create } from 'zustand';

/** Estado efímero de la interfaz (no se persiste). */
type UiState = {
  /**
   * IDs de notas seleccionadas en modo selección múltiple. Solo hay una lista enfocada a la vez:
   * la selección se vacía al salir de la pantalla.
   */
  selectedNoteIds: ReadonlySet<string>;
  toggleNoteSelection: (id: string) => void;
  /** Selecciona todos los IDs dados (o los deselecciona si ya lo estaban todos). */
  toggleSelectAll: (ids: string[]) => void;
  clearSelection: () => void;
};

export const useUiStore = create<UiState>()((set) => ({
  selectedNoteIds: new Set(),
  toggleNoteSelection: (id) =>
    set((state) => {
      const next = new Set(state.selectedNoteIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedNoteIds: next };
    }),
  toggleSelectAll: (ids) =>
    set((state) => {
      const all = ids.length > 0 && ids.every((id) => state.selectedNoteIds.has(id));
      return { selectedNoteIds: all ? new Set() : new Set(ids) };
    }),
  clearSelection: () => set({ selectedNoteIds: new Set() }),
}));

export const useIsSelecting = () => useUiStore((s) => s.selectedNoteIds.size > 0);
