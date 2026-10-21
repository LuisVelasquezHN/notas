import type { Attachment, Folder, Note, Tag } from '@/db/schema';

import { planPull, rowKey, toRemoteData, type LocalSnapshot, type RemoteChange } from '../plan';

const note = (id: string, updatedAt: number, extra: Partial<Note> = {}): Note => ({
  id,
  type: 'text',
  title: id,
  contentJson: null,
  contentText: '',
  folderId: null,
  color: 'default',
  isPinned: false,
  pinnedAt: null,
  isArchived: false,
  isFavorite: false,
  isLocked: false,
  sortKey: 'a0',
  createdAt: 1,
  updatedAt,
  deletedAt: null,
  ...extra,
});

const folder = (id: string, parentId: string | null = null): Folder => ({
  id,
  parentId,
  name: id,
  color: 'default',
  icon: null,
  sortKey: 'a0',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
});

const tag = (id: string, name: string): Tag => ({
  id,
  name,
  color: 'default',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
});

let seq = 0;
const change = (
  tbl: string,
  rowId: string,
  data: object | null,
  updatedAt = (data as { updatedAt?: number } | null)?.updatedAt ?? 1,
): RemoteChange => ({
  tbl,
  rowId,
  updatedAt,
  deleted: data === null,
  data: data as Record<string, unknown> | null,
  seq: ++seq,
});

const snapshot = (extra: Partial<LocalSnapshot> = {}): LocalSnapshot => ({
  ids: { folders: new Set(), notes: new Set(), checklistItems: new Set(), tags: new Set() },
  rows: new Map(),
  pending: new Map(),
  tags: [],
  ...extra,
});

describe('planPull', () => {
  it('añade las filas nuevas en orden de dependencias', () => {
    const plan = planPull(
      [
        change('notes', 'n1', note('n1', 5, { folderId: 'child' })),
        change('folders', 'child', folder('child', 'root')),
        change('folders', 'root', folder('root')),
      ],
      snapshot(),
    );
    expect(plan.upserts.map((u) => u.row.id)).toEqual(['root', 'child', 'n1']);
    expect(plan.upserts[2].row.folderId).toBe('child');
  });

  it('solo aplica el último cambio de cada fila', () => {
    const plan = planPull(
      [
        change('notes', 'n1', note('n1', 9, { title: 'nuevo' })),
        change('notes', 'n1', note('n1', 5)),
      ],
      snapshot(),
    );
    // El de `seq` mayor es el segundo, aunque su `updatedAt` sea menor: es lo que hay en el servidor.
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].row.updatedAt).toBe(5);
  });

  it('respeta un cambio local pendiente igual o más reciente', () => {
    const local = note('n1', 10, { title: 'local' });
    const plan = planPull(
      [change('notes', 'n1', note('n1', 8, { title: 'remoto' }))],
      snapshot({
        ids: { ...snapshot().ids, notes: new Set(['n1']) },
        rows: new Map([[rowKey('notes', 'n1'), local]]),
        pending: new Map([[rowKey('notes', 'n1'), { changedAt: 11, deleted: false }]]),
      }),
    );
    expect(plan.upserts).toHaveLength(0);
    expect(plan.dropPending).toHaveLength(0);
  });

  it('aplica la versión del servidor si es más reciente y descarta el pendiente', () => {
    const plan = planPull(
      [change('notes', 'n1', note('n1', 20, { title: 'remoto' }))],
      snapshot({
        ids: { ...snapshot().ids, notes: new Set(['n1']) },
        rows: new Map([[rowKey('notes', 'n1'), note('n1', 10)]]),
        pending: new Map([[rowKey('notes', 'n1'), { changedAt: 11, deleted: false }]]),
      }),
    );
    expect(plan.upserts[0].row.title).toBe('remoto');
    expect(plan.dropPending).toEqual([{ tbl: 'notes', rowId: 'n1' }]);
  });

  it('ignora lo que ya es igual (el eco de lo que subió este dispositivo)', () => {
    const local = note('n1', 10);
    const plan = planPull(
      [change('notes', 'n1', local)],
      snapshot({ rows: new Map([[rowKey('notes', 'n1'), local]]) }),
    );
    expect(plan.upserts).toHaveLength(0);
  });

  it('aplica un cambio de orden aunque `updatedAt` no cambie', () => {
    const plan = planPull(
      [change('notes', 'n1', note('n1', 10, { sortKey: 'a5' }))],
      snapshot({ rows: new Map([[rowKey('notes', 'n1'), note('n1', 10)]]) }),
    );
    expect(plan.upserts[0].row.sortKey).toBe('a5');
  });

  it('borra con las lápidas, primero lo que apunta a otras filas', () => {
    const plan = planPull(
      [change('notes', 'n1', null, 30), change('note_tags', 'n1|t1', null, 30)],
      snapshot({
        rows: new Map<string, Record<string, unknown>>([
          [rowKey('notes', 'n1'), note('n1', 10)],
          [rowKey('note_tags', 'n1|t1'), { noteId: 'n1', tagId: 't1', createdAt: 1 }],
        ]),
      }),
    );
    expect(plan.deletes).toEqual([
      { key: 'noteTags', rowId: 'n1|t1' },
      { key: 'notes', rowId: 'n1' },
    ]);
  });

  it('una nota editada después del borrado en otro dispositivo vuelve', () => {
    const plan = planPull(
      [change('notes', 'n1', note('n1', 50))],
      snapshot({ pending: new Map([[rowKey('notes', 'n1'), { changedAt: 40, deleted: true }]]) }),
    );
    expect(plan.upserts[0].row.id).toBe('n1');
    expect(plan.dropPending).toHaveLength(1);
  });

  it('descarta referencias rotas como al importar una copia', () => {
    const plan = planPull(
      [
        change('notes', 'n1', note('n1', 5, { folderId: 'missing' })),
        change('checklist_items', 'i1', {
          id: 'i1',
          noteId: 'ghost',
          text: 'x',
          isChecked: false,
          checkedAt: null,
          indent: 0,
          dueAt: null,
          sortKey: 'a0',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }),
        change('note_tags', 'n1|t9', { noteId: 'n1', tagId: 't9', createdAt: 1 }),
      ],
      snapshot(),
    );
    expect(plan.upserts.map((u) => [u.key, u.row.folderId ?? null])).toEqual([['notes', null]]);
  });

  it('valida los datos del servidor (filas incompletas o con otro id fuera)', () => {
    const plan = planPull(
      [
        change('notes', 'n1', { id: 'n1', updatedAt: 3 }),
        change('notes', 'n2', note('otra', 3)),
        change('desconocida', 'x', { id: 'x' }),
      ],
      snapshot(),
    );
    expect(plan.upserts).toHaveLength(0);
  });

  it('etiquetas con el mismo nombre: gana el id menor también si es la del servidor', () => {
    const plan = planPull(
      [change('tags', 'a-remote', tag('a-remote', 'Trabajo'))],
      snapshot({
        ids: { ...snapshot().ids, tags: new Set(['b-local']) },
        tags: [{ id: 'b-local', name: 'trabajo' }],
      }),
    );
    expect(plan.upserts.map((u) => u.row.id)).toEqual(['a-remote']);
    expect(plan.tagMerges).toEqual([{ from: 'b-local', to: 'a-remote' }]);
  });

  it('etiquetas con el mismo nombre: si gana la local, las notas de la remota pasan a ella', () => {
    const plan = planPull(
      [
        change('tags', 'z-remote', tag('z-remote', 'Trabajo')),
        change('notes', 'n1', note('n1', 5)),
        change('note_tags', 'n1|z-remote', { noteId: 'n1', tagId: 'z-remote', createdAt: 4 }),
      ],
      snapshot({
        ids: { ...snapshot().ids, tags: new Set(['a-local']) },
        tags: [{ id: 'a-local', name: 'Trabajo' }],
      }),
    );
    expect(plan.upserts.filter((u) => u.key === 'tags')).toHaveLength(0);
    const pair = plan.upserts.find((u) => u.key === 'noteTags');
    expect(pair).toMatchObject({ row: { noteId: 'n1', tagId: 'a-local' }, track: true });
  });

  it('carpetas inteligentes: los filtros por una etiqueta fundida pasan a la que gana', () => {
    const plan = planPull(
      [
        change('tags', 'z-remote', tag('z-remote', 'Casa')),
        change('saved_filters', 's1', {
          id: 's1',
          name: 'Casa',
          icon: null,
          queryJson: JSON.stringify({ tagIds: ['z-remote'] }),
          sortKey: 'a0',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        }),
      ],
      snapshot({
        ids: { ...snapshot().ids, tags: new Set(['a-local']) },
        tags: [{ id: 'a-local', name: 'casa' }],
      }),
    );
    const filter = plan.upserts.find((u) => u.key === 'savedFilters');
    expect(filter?.track).toBe(true);
    expect(JSON.parse(String(filter?.row.queryJson)).tagIds).toEqual(['a-local']);
  });

  it('adjuntos: conserva la ruta local y no la sube', () => {
    const local: Attachment = {
      id: 'a1',
      noteId: 'n1',
      kind: 'image',
      localUri: 'attachments/a1.jpg',
      mime: 'image/jpeg',
      size: 10,
      width: 1,
      height: 1,
      durationMs: null,
      sortKey: 'a0',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const remote = toRemoteData('attachments', local);
    expect(remote).not.toHaveProperty('localUri');

    const deleted = { ...remote, updatedAt: 9, deletedAt: 9 };
    const plan = planPull(
      [change('attachments', 'a1', deleted)],
      snapshot({
        ids: { ...snapshot().ids, notes: new Set(['n1']) },
        rows: new Map([[rowKey('attachments', 'a1'), local]]),
      }),
    );
    expect(plan.upserts[0].row).toMatchObject({ localUri: 'attachments/a1.jpg', deletedAt: 9 });

    // Uno que no está en el dispositivo llega sin ruta: se descarga antes de aplicarlo.
    const fresh = planPull(
      [change('attachments', 'a2', { ...remote, id: 'a2' })],
      snapshot({ ids: { ...snapshot().ids, notes: new Set(['n1']) } }),
    );
    expect(fresh.upserts[0].row.localUri).toBe('');
  });
});
