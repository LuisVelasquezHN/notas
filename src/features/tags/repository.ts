import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { noteTags, notes, tags, type Tag } from '@/db/schema';
import { uuidv7 } from '@/lib/ids';
import type { NoteColor } from '@/theme/tokens';

export const MAX_TAG_LENGTH = 40;

export function tagsQuery() {
  return getDb()
    .select()
    .from(tags)
    .where(isNull(tags.deletedAt))
    .orderBy(sql`${tags.name} COLLATE NOCASE`);
}

export function tagQuery(id: string) {
  return getDb()
    .select()
    .from(tags)
    .where(and(eq(tags.id, id), isNull(tags.deletedAt)))
    .limit(1);
}

/** Pares nota–etiqueta de las etiquetas vivas (para pintar las etiquetas en las tarjetas). */
export function noteTagsQuery() {
  return getDb()
    .select({ noteId: noteTags.noteId, tagId: noteTags.tagId })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(isNull(tags.deletedAt));
}

export function tagsForNoteQuery(noteId: string) {
  return getDb()
    .select({ id: tags.id, name: tags.name, color: tags.color })
    .from(noteTags)
    .innerJoin(tags, eq(tags.id, noteTags.tagId))
    .where(and(eq(noteTags.noteId, noteId), isNull(tags.deletedAt)))
    .orderBy(sql`${tags.name} COLLATE NOCASE`);
}

/** Número de notas activas por etiqueta. */
export function tagNoteCountsQuery() {
  return getDb()
    .select({ tagId: noteTags.tagId, count: sql<number>`count(*)` })
    .from(noteTags)
    .innerJoin(notes, eq(notes.id, noteTags.noteId))
    .where(and(isNull(notes.deletedAt), eq(notes.isArchived, false)))
    .groupBy(noteTags.tagId);
}

export type TagFields = { name: string; color: NoteColor };

export function cleanTagName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH);
}

async function findByName(name: string) {
  const [tag] = await getDb()
    .select()
    .from(tags)
    .where(sql`${tags.name} = ${name} COLLATE NOCASE`)
    .limit(1);
  return tag ?? null;
}

/**
 * `tags.name` es UNIQUE. Una etiqueta borrada (lógicamente) puede ocupar el nombre: se elimina del
 * todo antes de reutilizarlo. Así no "resucitan" sus asignaciones antiguas.
 */
async function freeDeletedName(name: string) {
  const existing = await findByName(name);
  if (existing && existing.deletedAt !== null) {
    await getDb().delete(tags).where(eq(tags.id, existing.id));
    return null;
  }
  return existing;
}

/** Crea la etiqueta o devuelve la que ya existe con ese nombre (sin distinguir mayúsculas). */
export async function createTag(fields: TagFields): Promise<Tag> {
  const name = cleanTagName(fields.name);
  const existing = await freeDeletedName(name);
  if (existing) return existing;
  const now = Date.now();
  const [tag] = await getDb()
    .insert(tags)
    .values({ id: uuidv7(now), name, color: fields.color, createdAt: now, updatedAt: now })
    .returning();
  return tag;
}

export class DuplicateTagError extends Error {
  constructor(name: string) {
    super(`Ya existe una etiqueta llamada «${name}»`);
  }
}

export async function updateTag(id: string, fields: Partial<TagFields>) {
  const patch: Partial<TagFields> = { ...fields };
  if (fields.name !== undefined) {
    const name = cleanTagName(fields.name);
    const existing = await freeDeletedName(name);
    if (existing && existing.id !== id) throw new DuplicateTagError(name);
    patch.name = name;
  }
  await getDb()
    .update(tags)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(tags.id, id));
}

/** Borrado lógico: las asignaciones se conservan para poder deshacer. */
export async function deleteTag(id: string) {
  const now = Date.now();
  await getDb().update(tags).set({ deletedAt: now, updatedAt: now }).where(eq(tags.id, id));
}

export async function restoreTag(id: string) {
  await getDb()
    .update(tags)
    .set({ deletedAt: null, updatedAt: Date.now() })
    .where(and(eq(tags.id, id), isNotNull(tags.deletedAt)));
}

/** Asigna (o quita) una etiqueta a varias notas. */
export async function setTagOnNotes(tagId: string, noteIds: string[], assigned: boolean) {
  if (noteIds.length === 0) return;
  const db = getDb();
  const now = Date.now();
  db.transaction((tx) => {
    if (assigned) {
      tx.insert(noteTags)
        .values(noteIds.map((noteId) => ({ noteId, tagId, createdAt: now })))
        .onConflictDoNothing()
        .run();
    } else {
      tx.delete(noteTags)
        .where(and(eq(noteTags.tagId, tagId), inArray(noteTags.noteId, noteIds)))
        .run();
    }
    // Cambiar etiquetas cuenta como modificar la nota (y la marca para una futura sincronización).
    tx.update(notes).set({ updatedAt: now }).where(inArray(notes.id, noteIds)).run();
  });
}

export function tagsByIdOrder(all: Tag[], ids: Iterable<string>): Tag[] {
  const wanted = new Set(ids);
  return all.filter((t) => wanted.has(t.id));
}
