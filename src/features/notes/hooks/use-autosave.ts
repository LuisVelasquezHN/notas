import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Espera antes de reintentar un guardado que falló, y cuántas veces seguidas como mucho. */
const RETRY_MS = 1000;
const MAX_RETRIES = 5;

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
  const retries = useRef(0);

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
    const previous = saved.current;
    const value = latest.current;
    saved.current = value;
    try {
      await saveRef.current(value);
      retries.current = 0;
    } catch (e) {
      // Si falla (p. ej. en web, el worker de SQLite tarda en responder), el cambio sigue
      // pendiente y se reintenta: no se pierde lo escrito.
      console.warn('Autoguardado: error, se reintentará', e);
      if (saved.current === value) saved.current = previous;
      if (Object.is(latest.current, saved.current)) return;
      dirty.current = true;
      if (++retries.current > MAX_RETRIES) return;
      if (!timer.current) timer.current = setTimeout(() => void flushRef.current(), RETRY_MS);
    }
  }, []);
  const flushRef = useRef(flush);

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
