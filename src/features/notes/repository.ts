import { and, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { notes, type NewNote, type NoteType } from '@/db/schema';
import { uuidv7 } from '@/lib/ids';
import { sortKeyBefore } from '@/lib/sort-key';

/** Notas activas (no archivadas ni en la papelera), ancladas primero. */
export function activeNotesQuery() {
  return getDb()
    .select()
    .from(notes)
    .where(and(isNull(notes.deletedAt), eq(notes.isArchived, false)))
    .orderBy(desc(notes.isPinned), desc(notes.updatedAt));
}

export async function createNote(
  type: NoteType = 'text',
  fields: Partial<Omit<NewNote, 'id' | 'type' | 'createdAt' | 'updatedAt'>> = {},
) {
  const db = getDb();
  const now = Date.now();
  const [first] = await db
    .select({ sortKey: notes.sortKey })
    .from(notes)
    .orderBy(notes.sortKey)
    .limit(1);

  const [note] = await db
    .insert(notes)
    .values({
      id: uuidv7(now),
      type,
      // Las notas nuevas aparecen arriba en el orden manual.
      sortKey: sortKeyBefore(first?.sortKey ?? null),
      createdAt: now,
      updatedAt: now,
      ...fields,
    })
    .returning();
  return note;
}
