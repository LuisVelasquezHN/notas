import type { Database } from '@/db/client';

import { SYNC_TABLES, SYNC_TABLE_KEYS, type SyncTableKey } from './tables';

/**
 * Apunta en `sync_outbox` cada fila que cambia, con triggers de SQLite: así se sube todo lo que
 * cambie, venga de donde venga (pantallas, scheduler, importar una copia, borrados en cascada…).
 * Mientras se aplican cambios del servidor (`sync_state.applying = 1`) no se apunta nada.
 * Como el índice de búsqueda, se crea al arrancar y es idempotente. Si cambia la definición,
 * se sube `VERSION` (los triggers antiguos se borran).
 */
const VERSION = 1;

/** Milisegundos UTC actuales en SQL (sin `unixepoch('subsec')`, que necesita SQLite 3.42). */
export const SQL_NOW_MS = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";

const NOT_APPLYING = 'coalesce((SELECT applying FROM sync_state WHERE id = 1), 0) = 0';

function rowIdExpr(key: SyncTableKey, ref: 'NEW' | 'OLD') {
  return key === 'noteTags' ? `${ref}.note_id || '|' || ${ref}.tag_id` : `${ref}.id`;
}

/** Columnas cuyo cambio no se sube (solo valen en este dispositivo). */
const UPDATE_COLUMNS: Partial<Record<SyncTableKey, string>> = {
  reminders:
    'note_id, checklist_item_id, fire_at, rrule, timezone, status, created_at, updated_at, deleted_at',
};

function upsertOutbox(key: SyncTableKey, ref: 'NEW' | 'OLD', deleted: 0 | 1) {
  const name = SYNC_TABLES[key].name;
  return `INSERT INTO sync_outbox (tbl, row_id, changed_at, deleted)
    VALUES ('${name}', ${rowIdExpr(key, ref)}, ${SQL_NOW_MS}, ${deleted})
    ON CONFLICT (tbl, row_id) DO UPDATE SET changed_at = excluded.changed_at, deleted = excluded.deleted;`;
}

function triggers(key: SyncTableKey): string {
  const name = SYNC_TABLES[key].name;
  const prefix = `sync_v${VERSION}_${name}`;
  const columns = UPDATE_COLUMNS[key];
  return `
CREATE TRIGGER IF NOT EXISTS ${prefix}_ai AFTER INSERT ON ${name} WHEN ${NOT_APPLYING} BEGIN
  ${upsertOutbox(key, 'NEW', 0)}
END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_au AFTER UPDATE${columns ? ` OF ${columns}` : ''} ON ${name} WHEN ${NOT_APPLYING} BEGIN
  ${upsertOutbox(key, 'NEW', 0)}
END;
CREATE TRIGGER IF NOT EXISTS ${prefix}_ad AFTER DELETE ON ${name} WHEN ${NOT_APPLYING} BEGIN
  ${upsertOutbox(key, 'OLD', 1)}
END;`;
}

export async function ensureSyncTracking(db: Database): Promise<void> {
  const sqlite = db.$client;
  const stale = await sqlite.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'sync_v%' AND name NOT LIKE 'sync_v${VERSION}_%'`,
  );
  await sqlite.withTransactionAsync(async () => {
    for (const { name } of stale) await sqlite.execAsync(`DROP TRIGGER IF EXISTS ${name};`);
    // Si la app se cerró a mitad de aplicar cambios, la transacción se deshizo: se deja a 0.
    await sqlite.execAsync(
      'INSERT INTO sync_state (id, applying) VALUES (1, 0) ON CONFLICT (id) DO UPDATE SET applying = 0;',
    );
    for (const key of SYNC_TABLE_KEYS) await sqlite.execAsync(triggers(key));
  });
}

/**
 * Apunta todas las filas como pendientes (primera sincronización con una cuenta): lo que ya
 * había en el dispositivo se sube y se fusiona con lo de la cuenta.
 */
export async function enqueueAll(db: Database): Promise<void> {
  const sqlite = db.$client;
  await sqlite.withTransactionAsync(async () => {
    for (const key of SYNC_TABLE_KEYS) {
      const name = SYNC_TABLES[key].name;
      const id = key === 'noteTags' ? "note_id || '|' || tag_id" : 'id';
      await sqlite.execAsync(
        `INSERT INTO sync_outbox (tbl, row_id, changed_at, deleted)
         SELECT '${name}', ${id}, ${SQL_NOW_MS}, 0 FROM ${name} WHERE 1
         ON CONFLICT (tbl, row_id) DO NOTHING;`,
      );
    }
  });
}
