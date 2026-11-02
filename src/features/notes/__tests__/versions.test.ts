import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';
import { sqliteClient } from '@/test/sqlite';

jest.mock('better-sqlite3', () => ({}), { virtual: true });
jest.mock('@/db/client', () => ({ getDb: () => mockDb }));
jest.mock('@/features/attachments/storage', () => ({}));

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof sqliteClient>;

// eslint-disable-next-line import/first
import { MAX_VERSIONS, VERSION_INTERVAL_MS, restoreVersion, snapshotNote } from '../versions';

const MIN = 60_000;
const doc = (text: string) =>
  JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  });

function setNote(title: string, text: string, updatedAt: number) {
  client.sqlite
    .prepare(
      'UPDATE notes SET title = ?, content_json = ?, content_text = ?, updated_at = ? WHERE id = ?',
    )
    .run(title, doc(text), text, updatedAt, 'n1');
}

const versions = () =>
  client.sqlite
    .prepare('SELECT title, content_json, created_at FROM note_versions ORDER BY created_at, id')
    .all() as { title: string; content_json: string; created_at: number }[];

beforeEach(() => {
  client = sqliteClient();
  mockDb = drizzle(client as never, { schema });
  client.sqlite.exec(
    "INSERT INTO notes (id, type, sort_key, created_at, updated_at) VALUES ('n1', 'text', 'a0', 1, 1)",
  );
});

it('no guarda versiones de una nota vacía', async () => {
  expect(await snapshotNote('n1')).toBe(false);
  expect(versions()).toEqual([]);
});

it('guarda la primera versión y luego solo cada cierto tiempo de edición', async () => {
  setNote('Lista', 'uno', 10 * MIN);
  expect(await snapshotNote('n1', { now: 10 * MIN })).toBe(true);
  setNote('Lista', 'dos', 12 * MIN);
  expect(await snapshotNote('n1', { now: 12 * MIN })).toBe(false);
  setNote('Lista', 'tres', 10 * MIN + VERSION_INTERVAL_MS);
  expect(await snapshotNote('n1', { now: 10 * MIN + VERSION_INTERVAL_MS })).toBe(true);
  expect(versions().map((v) => v.created_at)).toEqual([10 * MIN, 10 * MIN + VERSION_INTERVAL_MS]);
});

it('no repite una versión igual a la última, aunque se fuerce', async () => {
  setNote('A', 'uno', MIN);
  await snapshotNote('n1');
  expect(await snapshotNote('n1', { force: true })).toBe(false);
  expect(versions()).toHaveLength(1);
});

it(`se queda con las ${MAX_VERSIONS} más recientes`, async () => {
  for (let i = 0; i < MAX_VERSIONS + 5; i++) {
    setNote('A', `v${i}`, (i + 1) * VERSION_INTERVAL_MS);
    await snapshotNote('n1', { now: (i + 1) * VERSION_INTERVAL_MS });
  }
  const kept = versions();
  expect(kept).toHaveLength(MAX_VERSIONS);
  expect(kept[0].content_json).toBe(doc('v5'));
});

it('restaurar recupera el contenido y guarda antes el actual', async () => {
  setNote('Antes', 'contenido viejo', MIN);
  await snapshotNote('n1');
  setNote('Después', 'contenido nuevo', 2 * MIN);
  const [old] = client.sqlite.prepare('SELECT id FROM note_versions').all() as { id: string }[];

  expect(await restoreVersion(old.id)).toMatchObject({ noteId: 'n1' });
  const note = client.sqlite
    .prepare('SELECT title, content_text FROM notes WHERE id = ?')
    .get('n1') as { title: string; content_text: string };
  expect(note).toEqual({ title: 'Antes', content_text: 'contenido viejo' });
  expect(versions().map((v) => v.title)).toEqual(['Antes', 'Después']);
});

it('las versiones se borran con la nota', async () => {
  setNote('A', 'uno', MIN);
  await snapshotNote('n1');
  client.sqlite.exec("DELETE FROM notes WHERE id = 'n1'");
  expect(versions()).toEqual([]);
});
