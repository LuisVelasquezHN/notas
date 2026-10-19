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
});
