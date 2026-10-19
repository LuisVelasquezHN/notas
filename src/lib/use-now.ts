import { useEffect, useState } from 'react';

/** Hora actual que se actualiza cada `intervalMs` (p. ej. para pasar recordatorios a "vencidos"). */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
