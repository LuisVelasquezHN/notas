import { act, renderHook } from '@testing-library/react-native';

import { useAutosave } from '../hooks/use-autosave';

describe('useAutosave', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('reintenta un guardado que falla y no pierde el valor', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const save = jest
      .fn<Promise<void>, [string]>()
      .mockRejectedValueOnce(new Error('Sync operation timeout'))
      .mockResolvedValue(undefined);
    const { rerender } = await renderHook(
      ({ value }: { value: string }) => useAutosave(value, save, { delay: 100 }),
      {
        initialProps: { value: 'a' },
      },
    );

    await rerender({ value: 'b' });
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('b');
    warn.mockRestore();
  });

  it('deja de reintentar tras varios fallos seguidos', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const save = jest.fn<Promise<void>, [string]>().mockRejectedValue(new Error('x'));
    const { rerender } = await renderHook(
      ({ value }: { value: string }) => useAutosave(value, save, { delay: 100 }),
      {
        initialProps: { value: 'a' },
      },
    );
    await rerender({ value: 'b' });
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
    }
    expect(save).toHaveBeenCalledTimes(6);
    warn.mockRestore();
  });
});
