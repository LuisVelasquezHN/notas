import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';

/**
 * Dos dispositivos (cada uno con su SQLite real, `node:sqlite`) sincronizando contra un servidor
 * en memoria que se comporta como `sync_rows` + `push_changes` (supabase/migrations).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite');

type ServerRow = {
  tbl: string;
  row_id: string;
  updated_at: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
  seq: number;
};

class FakeServer {
  rows = new Map<string, ServerRow>();
  files = new Map<string, string>();
  seq = 0;

  push(changes: Omit<ServerRow, 'seq'>[]) {
    for (const c of JSON.parse(JSON.stringify(changes)) as Omit<ServerRow, 'seq'>[]) {
      const key = `${c.tbl}:${c.row_id}`;
      const existing = this.rows.get(key);
      if (existing && c.updated_at < existing.updated_at) continue;
      this.rows.set(key, { ...c, data: c.deleted ? null : c.data, seq: ++this.seq });
    }
  }

  live(tbl: string) {
    return [...this.rows.values()].filter((r) => r.tbl === tbl && !r.deleted);
  }
}

/** API de better-sqlite3 (la que usa Drizzle) sobre `node:sqlite`, más la de expo-sqlite. */
function sqliteClient() {
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
  const values = (row: unknown) => (row ? Object.values(row as object) : undefined);
  const params = (args: unknown[]) =>
    args.map((a) => (typeof a === 'boolean' ? Number(a) : a)) as never[];
  return {
    sqlite,
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      return {
        run: (...args: unknown[]) => stmt.run(...params(args)),
        all: (...args: unknown[]) => stmt.all(...params(args)),
        get: (...args: unknown[]) => stmt.get(...params(args)),
        raw: () => ({
          all: (...args: unknown[]) => stmt.all(...params(args)).map(values),
          get: (...args: unknown[]) => values(stmt.get(...params(args))),
        }),
      };
    },
    transaction(fn: (tx: unknown) => unknown) {
      const run = (tx: unknown) => {
        sqlite.exec('BEGIN');
        try {
          const result = fn(tx);
          sqlite.exec('COMMIT');
          return result;
        } catch (e) {
          sqlite.exec('ROLLBACK');
          throw e;
        }
      };
      return { deferred: run, immediate: run, exclusive: run };
    },
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
}

type Device = {
  client: ReturnType<typeof sqliteClient>;
  db: ReturnType<typeof drizzle<typeof schema>>;
  kv: Map<string, string>;
};

const mockServer = new FakeServer();
let mockCurrent: Device;

// El driver de Drizzle solo importa el paquete para abrir un fichero: aquí se le pasa el cliente.
jest.mock('better-sqlite3', () => ({}), { virtual: true });
jest.mock('@/db/client', () => ({ getDb: () => mockCurrent.db }));
jest.mock('expo-sqlite/kv-store', () => ({
  __esModule: true,
  default: {
    getItemSync: (k: string) => mockCurrent.kv.get(k) ?? null,
    setItemSync: (k: string, v: string) => mockCurrent.kv.set(k, v),
  },
}));
jest.mock('../files', () => ({
  uploadAttachment: async (userId: string, a: { id: string; localUri: string }) => {
    mockServer.files.set(`${userId}/${a.id}`, a.localUri);
  },
  downloadAttachment: async (userId: string, a: { id: string }) =>
    mockServer.files.has(`${userId}/${a.id}`) ? `attachments/${a.id}.downloaded` : null,
}));
jest.mock('../supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'user-1' } } } }) },
    rpc: async (_name: string, { changes }: { changes: Omit<ServerRow, 'seq'>[] }) => {
      mockServer.push(changes);
      return { error: null };
    },
    from: () => {
      let after = 0;
      let limit = Infinity;
      const query = {
        select: () => query,
        gt: (_c: string, value: number) => ((after = value), query),
        order: () => query,
        limit: (n: number) => ((limit = n), query),
        then: (resolve: (r: { data: ServerRow[]; error: null }) => void) =>
          resolve({
            data: JSON.parse(
              JSON.stringify(
                [...mockServer.rows.values()]
                  .filter((r) => r.seq > after)
                  .sort((a, b) => a.seq - b.seq)
                  .slice(0, limit),
              ),
            ),
            error: null,
          }),
      };
      return query;
    },
  }),
}));

// eslint-disable-next-line import/first
import { syncNow } from '../engine';
// eslint-disable-next-line import/first
import { ensureSyncTracking } from '../tracking';

async function device(): Promise<Device> {
  const client = sqliteClient();
  const db = drizzle(client as never, { schema });
  Object.assign(db, { $client: client });
  const d = { client, db, kv: new Map<string, string>() };
  await ensureSyncTracking(db as never);
  return d;
}

async function sync(d: Device) {
  mockCurrent = d;
  await syncNow();
}

const all = (d: Device, sql: string) => d.client.sqlite.prepare(sql).all();

const addNote = (d: Device, id: string, title: string, updatedAt: number, folderId?: string) =>
  d.client.sqlite
    .prepare(
      'INSERT INTO notes (id, title, folder_id, sort_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, title, folderId ?? null, 'a0', updatedAt, updatedAt);

beforeEach(() => {
  mockServer.rows.clear();
  mockServer.files.clear();
  mockServer.seq = 0;
});

describe('sincronización entre dos dispositivos', () => {
  it('lo que había en cada dispositivo acaba en los dos', async () => {
    const a = await device();
    const b = await device();
    a.client.sqlite.exec(
      "INSERT INTO folders (id, name, sort_key, created_at, updated_at) VALUES ('f1', 'Casa', 'a0', 1, 1)",
    );
    addNote(a, 'n1', 'Desde A', 10, 'f1');
    addNote(b, 'n2', 'Desde B', 11);

    await sync(a);
    await sync(b);
    await sync(a);

    for (const d of [a, b]) {
      expect(all(d, 'SELECT id, title, folder_id FROM notes ORDER BY id')).toEqual([
        { id: 'n1', title: 'Desde A', folder_id: 'f1' },
        { id: 'n2', title: 'Desde B', folder_id: null },
      ]);
      expect(all(d, 'SELECT count(*) AS n FROM sync_outbox')).toEqual([{ n: 0 }]);
    }
  });

  it('gana la edición más reciente y los borrados llegan al otro', async () => {
    const a = await device();
    const b = await device();
    addNote(a, 'n1', 'v1', 10);
    addNote(a, 'n2', 'borrar', 10);
    await sync(a);
    await sync(b);

    a.client.sqlite.exec("UPDATE notes SET title = 'vieja', updated_at = 20 WHERE id = 'n1'");
    b.client.sqlite.exec("UPDATE notes SET title = 'nueva', updated_at = 30 WHERE id = 'n1'");
    b.client.sqlite.exec("DELETE FROM notes WHERE id = 'n2'");
    await sync(a); // sube "vieja"
    await sync(b); // "nueva" gana; sube el borrado
    await sync(a);

    for (const d of [a, b]) {
      expect(all(d, 'SELECT id, title FROM notes')).toEqual([{ id: 'n1', title: 'nueva' }]);
    }
  });

  it('las ediciones que llegan del servidor no se vuelven a subir', async () => {
    const a = await device();
    const b = await device();
    addNote(a, 'n1', 'hola', 10);
    await sync(a);
    const seq = mockServer.seq;
    await sync(b);
    await sync(b);
    expect(mockServer.seq).toBe(seq);
    expect(all(b, 'SELECT count(*) AS n FROM sync_outbox')).toEqual([{ n: 0 }]);
  });

  it('etiquetas creadas con el mismo nombre en los dos se funden en una', async () => {
    const a = await device();
    const b = await device();
    for (const [d, tagId, noteId] of [
      [a, '01-a', 'na'],
      [b, '02-b', 'nb'],
    ] as const) {
      addNote(d, noteId, noteId, 10);
      d.client.sqlite.exec(
        `INSERT INTO tags (id, name, created_at, updated_at) VALUES ('${tagId}', 'Trabajo', 1, 1)`,
      );
      d.client.sqlite.exec(
        `INSERT INTO note_tags (note_id, tag_id, created_at) VALUES ('${noteId}', '${tagId}', 2)`,
      );
    }

    await sync(a);
    await sync(b);
    await sync(a);
    await sync(b);

    for (const d of [a, b]) {
      expect(all(d, 'SELECT id, name FROM tags')).toEqual([{ id: '01-a', name: 'Trabajo' }]);
      expect(all(d, 'SELECT note_id, tag_id FROM note_tags ORDER BY note_id')).toEqual([
        { note_id: 'na', tag_id: '01-a' },
        { note_id: 'nb', tag_id: '01-a' },
      ]);
    }
    expect(mockServer.live('tags').map((r) => r.row_id)).toEqual(['01-a']);
  });

  it('los adjuntos se suben y se descargan', async () => {
    const a = await device();
    const b = await device();
    addNote(a, 'n1', 'foto', 10);
    a.client.sqlite.exec(
      "INSERT INTO attachments (id, note_id, kind, local_uri, mime, sort_key, created_at, updated_at) VALUES ('at1', 'n1', 'image', 'attachments/at1.jpg', 'image/jpeg', 'a0', 1, 1)",
    );
    await sync(a);
    expect(mockServer.files.get('user-1/at1')).toBe('attachments/at1.jpg');
    expect(mockServer.live('attachments')[0].data).not.toHaveProperty('localUri');

    await sync(b);
    expect(all(b, 'SELECT id, local_uri FROM attachments')).toEqual([
      { id: 'at1', local_uri: 'attachments/at1.downloaded' },
    ]);
  });

  it('un cambio local hecho mientras tanto no se pierde', async () => {
    const a = await device();
    const b = await device();
    addNote(a, 'n1', 'v1', 10);
    await sync(a);
    await sync(b);
    // B edita sin sincronizar; A edita antes, pero B es más reciente.
    a.client.sqlite.exec("UPDATE notes SET title = 'A', updated_at = 20 WHERE id = 'n1'");
    b.client.sqlite.exec("UPDATE notes SET title = 'B', updated_at = 25 WHERE id = 'n1'");
    await sync(a);
    await sync(b);
    await sync(a);
    for (const d of [a, b]) expect(all(d, 'SELECT title FROM notes')).toEqual([{ title: 'B' }]);
  });
});
