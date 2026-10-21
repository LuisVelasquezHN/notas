import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync } from 'expo-sqlite';
import { Platform } from 'react-native';

import * as schema from './schema';

export const DATABASE_NAME = 'notas.db';

export type Database = ReturnType<typeof drizzle<typeof schema>>;

const OPEN_ATTEMPTS = 5;
const RETRY_DELAY_MS = 300;

let instance: Database | null = null;
let opening: Promise<Database> | null = null;

/**
 * Abre la base de datos una sola vez. La apertura es asíncrona a propósito: en web, SQLite vive en
 * un Web Worker y la primera operación síncrona fallaría si el worker aún no ha cargado.
 * Tras abrirla, el driver de Drizzle (síncrono) funciona igual en todas las plataformas.
 */
export function openDatabase(): Promise<Database> {
  opening ??= (async () => {
    // `enableChangeListener` es necesario para que `useLiveQuery` reaccione a los cambios.
    const sqlite = await withRetry(() =>
      openDatabaseAsync(DATABASE_NAME, { enableChangeListener: true }),
    );
    await sqlite.execAsync('PRAGMA foreign_keys = ON;');
    if (Platform.OS !== 'web') {
      await sqlite.execAsync('PRAGMA journal_mode = WAL;');
    }
    instance = drizzle(sqlite, { schema });
    return instance;
  })();
  return opening;
}

/**
 * En web, al cerrarse otra pestaña su candado (`tab-lock.web.ts`) puede liberarse un instante
 * antes que el fichero de OPFS: se reintenta la apertura unas cuantas veces.
 */
async function withRetry<T>(open: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await open();
    } catch (e) {
      if (Platform.OS !== 'web' || attempt >= OPEN_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
}

/** Base de datos ya abierta. Solo se puede usar dentro de `<AppBootstrap>` (o tras `openDatabase()`). */
export function getDb(): Database {
  if (!instance) {
    throw new Error('La base de datos aún no está abierta: usa getDb() dentro de <AppBootstrap>.');
  }
  return instance;
}
