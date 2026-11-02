import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';
import { sqliteClient } from '@/test/sqlite';

jest.mock('better-sqlite3', () => ({}), { virtual: true });
jest.mock('@/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../storage', () => ({}));

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof sqliteClient>;

// eslint-disable-next-line import/first
import { syncInlineImages } from '../repository';

const imageDoc = (...ids: string[]) => ({
  type: 'doc' as const,
  content: ids.map((id) => ({ type: 'attachmentImage', attrs: { id } })),
});

beforeEach(() => {
  client = sqliteClient();
  mockDb = drizzle(client as never, { schema });
  client.sqlite.exec(
    "INSERT INTO notes (id, sort_key, created_at, updated_at) VALUES ('n1', 'a0', 1, 1)",
  );
  for (const [id, placement] of [
    ['i1', 'inline'],
    ['i2', 'inline'],
    ['c1', 'cover'],
  ]) {
    client.sqlite.exec(
      `INSERT INTO attachments (id, note_id, kind, placement, local_uri, sort_key, created_at, updated_at)
       VALUES ('${id}', 'n1', 'image', '${placement}', 'x', 'a0', 1, 1)`,
    );
  }
});

const deleted = () =>
  (
    client.sqlite
      .prepare('SELECT id FROM attachments WHERE deleted_at IS NOT NULL ORDER BY id')
      .all() as {
      id: string;
    }[]
  ).map((r) => r.id);

it('una imagen que sale del texto se marca como borrada; al deshacer, vuelve', async () => {
  await syncInlineImages('n1', imageDoc('i1', 'i2'));
  expect(deleted()).toEqual([]);
  await syncInlineImages('n1', imageDoc('i1'));
  expect(deleted()).toEqual(['i2']);
  await syncInlineImages('n1', imageDoc('i1', 'i2'));
  expect(deleted()).toEqual([]);
});

it('no toca las imágenes de portada', async () => {
  await syncInlineImages('n1', imageDoc());
  expect(deleted()).toEqual(['i1', 'i2']);
});
