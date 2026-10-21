const LOCK_NAME = 'notas-database';

/**
 * En web, SQLite guarda los datos en OPFS, que solo admite una conexión por fichero: una segunda
 * pestaña no podría abrir la base de datos ni el almacén de preferencias. Esta pestaña se queda
 * el candado (Web Locks) mientras esté abierta; si otra ya lo tiene, avisa con `onWaiting` y
 * continúa sola cuando la otra se cierra.
 */
export function acquireDatabaseLock(onWaiting: () => void): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.locks) return Promise.resolve();
  return new Promise((resolve) => {
    // El candado dura lo que la promesa que devuelve el callback: nunca se resuelve.
    const hold = () => {
      resolve();
      return new Promise<never>(() => {});
    };
    void navigator.locks.request(LOCK_NAME, { ifAvailable: true }, (lock) => {
      if (lock) return hold();
      onWaiting();
      void navigator.locks.request(LOCK_NAME, hold);
      return undefined;
    });
  });
}
