import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

type AutosaveOptions = {
  delay?: number;
  /** Se ejecuta al desmontar, después del último guardado. */
  onUnmount?: () => void;
};

/**
 * Guarda `value` con `save` cuando deja de cambiar durante `delay` ms, al pasar la app a segundo
 * plano y al desmontar. No guarda el valor inicial. Devuelve `flush` para forzar el guardado.
 */
export function useAutosave<T>(
  value: T,
  save: (value: T) => Promise<void>,
  { delay = 500, onUnmount }: AutosaveOptions = {},
) {
  const latest = useRef(value);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveRef = useRef(save);
  const onUnmountRef = useRef(onUnmount);
  /** Último valor guardado (o el inicial): si `value` vuelve a él, no hay nada que guardar. */
  const saved = useRef(value);

  useEffect(() => {
    saveRef.current = save;
    onUnmountRef.current = onUnmount;
  });

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (!dirty.current) return;
    dirty.current = false;
    saved.current = latest.current;
    await saveRef.current(latest.current);
  }, []);

  useEffect(() => {
    latest.current = value;
    if (Object.is(value, saved.current)) return;
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), delay);
  }, [value, delay, flush]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') void flush();
    });
    return () => {
      sub.remove();
      void flush().then(() => onUnmountRef.current?.());
    };
  }, [flush]);

  return flush;
}
