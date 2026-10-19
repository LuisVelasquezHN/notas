import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql, type SQL } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { checklistItems, notes, type NewNote, type Note, type NoteType } from '@/db/schema';
import {
  docToText,
  parseDoc,
  serializeDoc,
  textToDoc,
  type EditorDoc,
} from '@/features/editor/doc';
import { buildFtsMatch, likePattern, searchTerms } from '@/features/search/query';
import { capabilities } from '@/lib/capabilities';
import { DAY_MS, TRASH_RETENTION_DAYS } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { sortKeyBefore, sortKeysBetween } from '@/lib/sort-key';
import type { NotesSortBy } from '@/stores/settings-store';
import type { NoteColor } from '@/theme/tokens';

export type NoteScope = 'active' | 'archived' | 'trash';

export type NotesFilter = {
  scope: NoteScope;
  /** `undefined`: cualquier carpeta · `null`: sin carpeta · `string`: esa carpeta. */
  folderId?: string | null;
  /** Texto a buscar en título y contenido (incluye los ítems de las checklists). */
  search?: string;
  sortBy?: NotesSortBy;
};

function scopeCondition(scope: NoteScope): SQL | undefined {
  switch (scope) {
    case 'active':
      return and(isNull(notes.deletedAt), eq(notes.isArchived, false));
    case 'archived':
      return and(isNull(notes.deletedAt), eq(notes.isArchived, true));
    case 'trash':
      return isNotNull(notes.deletedAt);
  }
}

function searchCondition(search: string | undefined): SQL | undefined {
  if (!search?.trim()) return undefined;
  if (capabilities.fullTextSearch) {
    const match = buildFtsMatch(search);
    if (!match) return undefined;
    return inArray(notes.id, sql`(SELECT note_id FROM notes_fts WHERE notes_fts MATCH ${match})`);
  }
  // Web: sin FTS5, cada palabra debe aparecer en el título o en el texto.
  return and(
    ...searchTerms(search).map((term) => {
      const pattern = likePattern(term);
      return sql`(${notes.title} LIKE ${pattern} ESCAPE '\\' OR ${notes.contentText} LIKE ${pattern} ESCAPE '\\')`;
    }),
  );
}

function orderBy(scope: NoteScope, sortBy: NotesSortBy) {
  if (scope === 'trash') return [desc(notes.deletedAt)];
  // Las ancladas siempre primero (salvo en la papelera).
  const pinned = [desc(notes.isPinned), desc(notes.pinnedAt)];
  switch (sortBy) {
    case 'createdAt':
      return [...pinned, desc(notes.createdAt)];
    case 'title':
      // Las notas sin título van al final.
      return [...pinned, sql`${notes.title} = ''`, sql`${notes.title} COLLATE NOCASE`];
    case 'manual':
      return [...pinned, asc(notes.sortKey)];
    case 'updatedAt':
      return [...pinned, desc(notes.updatedAt)];
  }
}

export function notesQuery({ scope, folderId, search, sortBy = 'updatedAt' }: NotesFilter) {
  const folder =
    folderId === undefined
      ? undefined
      : folderId === null
        ? isNull(notes.folderId)
        : eq(notes.folderId, folderId);
  return getDb()
    .select()
    .from(notes)
    .where(and(scopeCondition(scope), folder, searchCondition(search)))
    .orderBy(...orderBy(scope, sortBy));
}

export function noteQuery(id: string) {
  return getDb().select().from(notes).where(eq(notes.id, id)).limit(1);
}

/** Número de notas activas por carpeta. */
export function folderNoteCountsQuery() {
  return getDb()
    .select({ folderId: notes.folderId, count: sql<number>`count(*)` })
    .from(notes)
    .where(and(scopeCondition('active'), isNotNull(notes.folderId)))
    .groupBy(notes.folderId);
}

async function firstSortKey(): Promise<string | null> {
  const [first] = await getDb()
    .select({ sortKey: notes.sortKey })
    .from(notes)
    .orderBy(asc(notes.sortKey))
    .limit(1);
  return first?.sortKey ?? null;
}

export async function createNote(
  type: NoteType = 'text',
  fields: Partial<Omit<NewNote, 'id' | 'type' | 'createdAt' | 'updatedAt'>> = {},
) {
  const now = Date.now();
  const [note] = await getDb()
    .insert(notes)
    .values({
      id: uuidv7(now),
      type,
      // Las notas nuevas aparecen arriba en el orden manual.
      sortKey: sortKeyBefore(await firstSortKey()),
      createdAt: now,
      updatedAt: now,
      ...fields,
    })
    .returning();
  return note;
}

type NotePatch = Partial<
  Pick<
    Note,
    | 'title'
    | 'contentJson'
    | 'contentText'
    | 'folderId'
    | 'color'
    | 'isPinned'
    | 'pinnedAt'
    | 'isArchived'
    | 'deletedAt'
    | 'type'
  >
>;

export async function updateNote(id: string, patch: NotePatch) {
  await getDb()
    .update(notes)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(notes.id, id));
}

/** Actualiza varias notas a la vez (anclar, color, carpeta, archivar, papelera…). */
export async function updateNotes(ids: string[], patch: NotePatch) {
  await getDb()
    .update(notes)
    .set({ ...patch, updatedAt: Date.now() })
    .where(inArray(notes.id, ids));
}

/**
 * Guarda el borrador del editor de texto. Solo afecta a notas de texto: si la nota se ha convertido
 * en checklist mientras tanto, un autoguardado tardío no pisa su contenido.
 */
export async function saveNoteContent(id: string, title: string, doc: EditorDoc) {
  await getDb()
    .update(notes)
    .set({
      title,
      contentJson: serializeDoc(doc),
      contentText: docToText(doc),
      updatedAt: Date.now(),
    })
    .where(and(eq(notes.id, id), eq(notes.type, 'text')));
}

export function setPinned(ids: string[], pinned: boolean) {
  return updateNotes(ids, { isPinned: pinned, pinnedAt: pinned ? Date.now() : null });
}

export function setColor(ids: string[], color: NoteColor) {
  return updateNotes(ids, { color });
}

export function moveToFolder(ids: string[], folderId: string | null) {
  return updateNotes(ids, { folderId });
}

export function setArchived(ids: string[], archived: boolean) {
  // Al archivar se desancla: una nota archivada no tiene sentido arriba del todo al volver.
  return updateNotes(
    ids,
    archived ? { isArchived: true, isPinned: false, pinnedAt: null } : { isArchived: false },
  );
}

export function moveToTrash(ids: string[]) {
  return updateNotes(ids, { deletedAt: Date.now(), isPinned: false, pinnedAt: null });
}

export function restoreFromTrash(ids: string[]) {
  return updateNotes(ids, { deletedAt: null });
}

/** Borrado físico (también borra en cascada ítems, recordatorios y adjuntos). */
export async function deletePermanently(ids: string[]) {
  if (ids.length === 0) return;
  await getDb().delete(notes).where(inArray(notes.id, ids));
}

export async function emptyTrash() {
  await getDb().delete(notes).where(isNotNull(notes.deletedAt));
}

/** Borra definitivamente lo que lleva más de 30 días en la papelera. Se ejecuta al arrancar. */
export async function purgeExpiredTrash(now: number = Date.now()) {
  const limit = now - TRASH_RETENTION_DAYS * DAY_MS;
  const db = getDb();
  await db.delete(notes).where(and(isNotNull(notes.deletedAt), lt(notes.deletedAt, limit)));
  await db
    .delete(checklistItems)
    .where(and(isNotNull(checklistItems.deletedAt), lt(checklistItems.deletedAt, limit)));
}

/** Elimina una nota recién creada que se ha dejado vacía, para no llenar la lista de notas en blanco. */
export async function discardIfEmpty(id: string) {
  const db = getDb();
  const [note] = await noteQuery(id);
  if (!note || note.title.trim() || note.contentText.trim()) return false;
  await db.delete(notes).where(eq(notes.id, id));
  return true;
}

export async function duplicateNote(id: string) {
  const db = getDb();
  const [source] = await noteQuery(id);
  if (!source) return null;
  const items = await db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.noteId, id), isNull(checklistItems.deletedAt)))
    .orderBy(asc(checklistItems.sortKey));

  const now = Date.now();
  const copyId = uuidv7(now);
  const sortKey = sortKeyBefore(await firstSortKey());
  db.transaction((tx) => {
    tx.insert(notes)
      .values({
        ...source,
        id: copyId,
        title: source.title ? `${source.title} (copia)` : '',
        isPinned: false,
        pinnedAt: null,
        isArchived: false,
        deletedAt: null,
        sortKey,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    if (items.length > 0) {
      tx.insert(checklistItems)
        .values(
          items.map((item) => ({
            ...item,
            id: uuidv7(now),
            noteId: copyId,
            createdAt: now,
            updatedAt: now,
          })),
        )
        .run();
    }
  });
  return copyId;
}

/**
 * Cambia el tipo entre texto y checklist sin perder contenido:
 * texto → una línea por ítem · checklist → un párrafo por ítem (los completados, al final).
 */
export async function convertNote(id: string, to: 'text' | 'checklist') {
  const db = getDb();
  const [note] = await noteQuery(id);
  if (!note || note.type === to) return;
  const now = Date.now();

  if (to === 'checklist') {
    const lines = docToText(parseDoc(note.contentJson))
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const keys = sortKeysBetween(null, null, lines.length);
    db.transaction((tx) => {
      if (lines.length > 0) {
        tx.insert(checklistItems)
          .values(
            lines.map((text, i) => ({
              id: uuidv7(now),
              noteId: id,
              text,
              sortKey: keys[i],
              createdAt: now,
              updatedAt: now,
            })),
          )
          .run();
      }
      tx.update(notes)
        .set({
          type: 'checklist',
          contentJson: null,
          contentText: lines.join('\n'),
          updatedAt: now,
        })
        .where(eq(notes.id, id))
        .run();
    });
    return;
  }

  const items = await db
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.noteId, id), isNull(checklistItems.deletedAt)))
    .orderBy(asc(checklistItems.isChecked), asc(checklistItems.sortKey));
  const text = items.map((i) => i.text).join('\n');
  db.transaction((tx) => {
    tx.update(checklistItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(checklistItems.noteId, id))
      .run();
    tx.update(notes)
      .set({
        type: 'text',
        contentJson: serializeDoc(textToDoc(text)),
        contentText: text,
        updatedAt: now,
      })
      .where(eq(notes.id, id))
      .run();
  });
}
