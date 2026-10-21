import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * Adaptador síncrono de expo-sqlite/kv-store para zustand `persist`.
 * Requiere `warmUpKvStorage()` antes del primer uso (ver `AppBootstrap`).
 */
export const kvStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => {
    Storage.removeItemSync(key);
  },
};

/**
 * Abre el almacén de forma asíncrona. En web, la primera operación síncrona fallaría
 * si el worker de SQLite aún no ha cargado; después, la API síncrona es segura.
 */
export async function warmUpKvStorage(): Promise<void> {
  await Storage.getLengthAsync();
}
