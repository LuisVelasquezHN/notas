import { showUndo, useSnackbarStore } from '../snackbar-store';

describe('snackbar store', () => {
  it('muestra y cierra mensajes', () => {
    const undo = jest.fn();
    showUndo('Nota archivada', undo);
    const current = useSnackbarStore.getState().current!;
    expect(current.message).toBe('Nota archivada');
    expect(current.action?.label).toBe('Deshacer');
    current.action?.onPress();
    expect(undo).toHaveBeenCalled();

    // Un temporizador antiguo no cierra un mensaje nuevo.
    useSnackbarStore.getState().show('Otro');
    useSnackbarStore.getState().dismiss(current.id);
    expect(useSnackbarStore.getState().current?.message).toBe('Otro');
    useSnackbarStore.getState().dismiss();
    expect(useSnackbarStore.getState().current).toBeNull();
  });
});
