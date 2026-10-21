import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@/db/client';

import { enqueueAll, ensureSyncTracking } from '../tracking';

/**
 * Los triggers de seguimiento contra un SQLite real (`node:sqlite`, Node 22.5+) con las
 * migraciones de verdad.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

function open() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const dir = join(__dirname, '../../../../drizzle');
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()) {
    for (const statement of readFileSync(join(dir, file), 'utf8').split(
      '--> statement-breakpoint',
    )) {
      sqlite.exec(statement);
    }
  }
  const client = {
    execAsync: async (sql: string) => sqlite.exec(sql),
    getAllAsync: async (sql: string) => sqlite.prepare(sql).all(),
    withTransactionAsync: async (task: () => Promise<void>) => {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (e) {
        sqlite.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return { sqlite, db: { $client: client } as unknown as Database };
}

const outbox = (sqlite: import('node:sqlite').DatabaseSync) =>
  sqlite.prepare('SELECT tbl, row_id, deleted FROM sync_outbox ORDER BY tbl, row_id').all();

const insertNote = (sqlite: import('node:sqlite').DatabaseSync, id: string) =>
  sqlite
    .prepare("INSERT INTO notes (id, sort_key, created_at, updated_at) VALUES (?, 'a0', 1, 1)")
    .run(id);

describe('seguimiento de cambios', () => {
  it('apunta altas, cambios y borrados (también en cascada)', async () => {
    const { sqlite, db } = open();
    await ensureSyncTracking(db);
    insertNote(sqlite, 'n1');
    sqlite.exec("INSERT INTO tags (id, name, created_at, updated_at) VALUES ('t1', 'x', 1, 1)");
    sqlite.exec("INSERT INTO note_tags (note_id, tag_id, created_at) VALUES ('n1', 't1', 1)");
    expect(outbox(sqlite)).toEqual([
      { tbl: 'note_tags', row_id: 'n1|t1', deleted: 0 },
      { tbl: 'notes', row_id: 'n1', deleted: 0 },
      { tbl: 'tags', row_id: 't1', deleted: 0 },
    ]);

    sqlite.exec('DELETE FROM sync_outbox');
    sqlite.exec("DELETE FROM notes WHERE id = 'n1'");
    expect(outbox(sqlite)).toEqual([
      { tbl: 'note_tags', row_id: 'n1|t1', deleted: 1 },
      { tbl: 'notes', row_id: 'n1', deleted: 1 },
    ]);

    // Volver a crearla la deja como alta, no como borrado.
    insertNote(sqlite, 'n1');
    expect(outbox(sqlite)).toContainEqual({ tbl: 'notes', row_id: 'n1', deleted: 0 });
  });

  it('no apunta lo que se aplica desde el servidor', async () => {
    const { sqlite, db } = open();
    await ensureSyncTracking(db);
    sqlite.exec('UPDATE sync_state SET applying = 1 WHERE id = 1');
    insertNote(sqlite, 'n1');
    sqlite.exec('UPDATE sync_state SET applying = 0 WHERE id = 1');
    expect(outbox(sqlite)).toEqual([]);
  });

  it('el id de notificación del sistema no cuenta como cambio del recordatorio', async () => {
    const { sqlite, db } = open();
    insertNote(sqlite, 'n1');
    sqlite.exec(
      "INSERT INTO reminders (id, note_id, fire_at, timezone, created_at, updated_at) VALUES ('r1', 'n1', 5, 'UTC', 1, 1)",
    );
    await ensureSyncTracking(db);
    sqlite.exec("UPDATE reminders SET os_notification_id = 'x' WHERE id = 'r1'");
    expect(outbox(sqlite)).toEqual([]);
    sqlite.exec("UPDATE reminders SET status = 'done' WHERE id = 'r1'");
    expect(outbox(sqlite)).toEqual([{ tbl: 'reminders', row_id: 'r1', deleted: 0 }]);
  });

  it('es idempotente y `enqueueAll` apunta todo lo que ya había', async () => {
    const { sqlite, db } = open();
    insertNote(sqlite, 'n1');
    insertNote(sqlite, 'n2');
    await ensureSyncTracking(db);
    await ensureSyncTracking(db);
    expect(outbox(sqlite)).toEqual([]);
    await enqueueAll(db);
    await enqueueAll(db);
    expect(outbox(sqlite)).toEqual([
      { tbl: 'notes', row_id: 'n1', deleted: 0 },
      { tbl: 'notes', row_id: 'n2', deleted: 0 },
    ]);
    const [{ changed_at }] = sqlite.prepare('SELECT changed_at FROM sync_outbox').all() as {
      changed_at: number;
    }[];
    expect(Math.abs(changed_at - Date.now())).toBeLessThan(60_000);
  });
});
