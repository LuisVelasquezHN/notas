import type { Folder, Note, SavedFilter, Tag } from '@/db/schema';

import { BACKUP_FORMAT, BackupFormatError, parseBackup, type BackupData } from '../format';
import { planImport, type LocalIndex } from '../plan';

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

const folder = (id: string, parentId: string | null): Folder => ({
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

const empty = (): BackupData => ({
  folders: [],
  notes: [],
  checklistItems: [],
  tags: [],
  noteTags: [],
  reminders: [],
  attachments: [],
  savedFilters: [],
});

const local = (overrides: Partial<LocalIndex['stamps']> = {}, extra: Partial<LocalIndex> = {}) =>
  ({
    stamps: {
      folders: new Map(),
      notes: new Map(),
      checklistItems: new Map(),
      tags: new Map(),
      reminders: new Map(),
      attachments: new Map(),
      savedFilters: new Map(),
      ...overrides,
    },
    tagNames: [],
    noteTagKeys: new Set(),
    ...extra,
  }) satisfies LocalIndex;

describe('leer una copia', () => {
  const file = (data: unknown, version = 1) =>
    JSON.stringify({ format: BACKUP_FORMAT, version, exportedAt: 5, data, files: {} });

  it('rechaza ficheros que no son copias o son de una versión más nueva', () => {
    expect(() => parseBackup('no es json')).toThrow(BackupFormatError);
    expect(() => parseBackup('{"format":"otra"}')).toThrow(BackupFormatError);
    try {
      parseBackup(file({}, 99));
    } catch (e) {
      expect((e as BackupFormatError).reason).toBe('newerVersion');
    }
  });

  it('descarta filas incompletas y columnas desconocidas, y acepta booleanos 0/1', () => {
    const backup = parseBackup(
      file({
        notes: [
          { ...note('n1', 2), isPinned: 1, hacker: 'x' },
          { id: 'sin-fechas', title: 'x' },
          'basura',
        ],
      }),
    );
    expect(backup.data.notes).toHaveLength(1);
    expect(backup.data.notes[0].isPinned).toBe(true);
    expect(backup.data.notes[0]).not.toHaveProperty('hacker');
    expect(backup.data.tags).toEqual([]);
  });

  it('una copia exportada se lee igual', () => {
    const data = { ...empty(), notes: [note('n1', 2)], folders: [folder('f1', null)] };
    expect(parseBackup(file(data)).data).toEqual({ ...empty(), ...data });
  });
});

describe('fusionar una copia', () => {
  it('añade lo nuevo y solo actualiza lo que es más reciente en la copia', () => {
    const data = { ...empty(), notes: [note('nueva', 5), note('vieja', 1), note('reciente', 9)] };
    const plan = planImport(
      data,
      local({
        notes: new Map([
          ['vieja', 3],
          ['reciente', 3],
        ]),
      }),
    );
    expect(plan.notes.insert.map((n) => n.id)).toEqual(['nueva']);
    expect(plan.notes.update.map((n) => n.id)).toEqual(['reciente']);
  });

  it('importar dos veces la misma copia no cambia nada', () => {
    const data = { ...empty(), notes: [note('a', 5)] };
    const plan = planImport(data, local({ notes: new Map([['a', 5]]) }));
    expect(plan.notes.insert).toEqual([]);
    expect(plan.notes.update).toEqual([]);
  });

  it('ordena las carpetas con los padres primero y suelta referencias rotas', () => {
    const data = {
      ...empty(),
      folders: [folder('hija', 'padre'), folder('padre', null), folder('huerfana', 'no-existe')],
      notes: [note('n', 1, { folderId: 'borrada' })],
    };
    const plan = planImport(data, local());
    expect(plan.folders.insert.map((f) => f.id)).toEqual(['padre', 'hija', 'huerfana']);
    expect(plan.folders.insert.find((f) => f.id === 'huerfana')?.parentId).toBeNull();
    expect(plan.notes.insert[0].folderId).toBeNull();
  });

  it('descarta ítems, recordatorios y adjuntos de notas que no existen', () => {
    const data: BackupData = {
      ...empty(),
      checklistItems: [
        {
          id: 'i1',
          noteId: 'falta',
          text: 'x',
          isChecked: false,
          checkedAt: null,
          indent: 0,
          dueAt: null,
          sortKey: 'a0',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        },
      ],
    };
    expect(planImport(data, local()).checklistItems.insert).toEqual([]);
  });

  it('funde las etiquetas con el mismo nombre y mantiene sus notas y filtros', () => {
    const filter: SavedFilter = {
      id: 's1',
      name: 'Trabajo',
      icon: null,
      queryJson: JSON.stringify({ tagIds: ['t-copia'] }),
      sortKey: 'a0',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const data: BackupData = {
      ...empty(),
      notes: [note('n1', 1)],
      tags: [tag('t-copia', 'Trabajo')],
      noteTags: [{ noteId: 'n1', tagId: 't-copia', createdAt: 1 }],
      savedFilters: [filter],
    };
    const plan = planImport(
      data,
      local(
        { tags: new Map([['t-local', 1]]) },
        { tagNames: [{ id: 't-local', name: 'trabajo' }] },
      ),
    );
    expect(plan.tags.insert).toEqual([]);
    expect(plan.noteTags.insert).toEqual([{ noteId: 'n1', tagId: 't-local', createdAt: 1 }]);
    expect(JSON.parse(plan.savedFilters.insert[0].queryJson).tagIds).toEqual(['t-local']);
  });

  it('no duplica etiquetas ya asignadas', () => {
    const data: BackupData = {
      ...empty(),
      notes: [note('n1', 1)],
      tags: [tag('t1', 'x')],
      noteTags: [{ noteId: 'n1', tagId: 't1', createdAt: 1 }],
    };
    const plan = planImport(
      data,
      local(
        { notes: new Map([['n1', 1]]), tags: new Map([['t1', 1]]) },
        { tagNames: [{ id: 't1', name: 'x' }], noteTagKeys: new Set(['n1|t1']) },
      ),
    );
    expect(plan.noteTags.insert).toEqual([]);
  });

  it('los recordatorios importados no conservan la notificación del otro dispositivo', () => {
    const data: BackupData = {
      ...empty(),
      notes: [note('n1', 1)],
      reminders: [
        {
          id: 'r1',
          noteId: 'n1',
          checklistItemId: null,
          fireAt: 10,
          rrule: null,
          timezone: 'Europe/Madrid',
          status: 'scheduled',
          osNotificationId: 'ios-123',
          createdAt: 1,
          updatedAt: 1,
          deletedAt: null,
        },
      ],
    };
    expect(planImport(data, local()).reminders.insert[0].osNotificationId).toBeNull();
  });
});
