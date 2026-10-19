import { useUiStore } from '../ui-store';

describe('ui-store', () => {
  beforeEach(() => useUiStore.getState().clearSelection());

  it('alterna la selección de notas', () => {
    const { toggleNoteSelection } = useUiStore.getState();
    toggleNoteSelection('a');
    toggleNoteSelection('b');
    toggleNoteSelection('a');
    expect([...useUiStore.getState().selectedNoteIds]).toEqual(['b']);
  });

  it('selecciona todo y, si ya estaba todo, lo deselecciona', () => {
    const { toggleNoteSelection, toggleSelectAll } = useUiStore.getState();
    toggleNoteSelection('a');
    toggleSelectAll(['a', 'b', 'c']);
    expect([...useUiStore.getState().selectedNoteIds]).toEqual(['a', 'b', 'c']);
    toggleSelectAll(['a', 'b', 'c']);
    expect(useUiStore.getState().selectedNoteIds.size).toBe(0);
  });
});
