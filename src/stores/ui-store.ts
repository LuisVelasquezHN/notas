import { create } from 'zustand';

/** Estado efímero de la interfaz (no se persiste). */
type UiState = {
  /** IDs de notas seleccionadas en modo selección múltiple. */
  selectedNoteIds: ReadonlySet<string>;
  toggleNoteSelection: (id: string) => void;
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
  clearSelection: () => set({ selectedNoteIds: new Set() }),
}));
