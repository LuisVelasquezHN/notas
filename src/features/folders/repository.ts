import { asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { folders, notes, type Folder } from '@/db/schema';
import { uuidv7 } from '@/lib/ids';
import { sortKeyAfter } from '@/lib/sort-key';
import type { NoteColor } from '@/theme/tokens';

import { descendantIds } from './tree';

export function foldersQuery() {
  return getDb()
    .select()
    .from(folders)
    .where(isNull(folders.deletedAt))
    .orderBy(asc(folders.sortKey));
}

export type FolderFields = { name: string; color: NoteColor; icon: string | null };

export async function createFolder(fields: FolderFields & { parentId: string | null }) {
  const db = getDb();
  const [last] = await db
    .select({ sortKey: folders.sortKey })
    .from(folders)
    .where(fields.parentId ? eq(folders.parentId, fields.parentId) : isNull(folders.parentId))
    .orderBy(desc(folders.sortKey))
    .limit(1);
  const now = Date.now();
  const [folder] = await db
    .insert(folders)
    .values({
      id: uuidv7(now),
      ...fields,
      name: fields.name.trim(),
      sortKey: sortKeyAfter(last?.sortKey ?? null),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return folder;
}

export async function updateFolder(id: string, fields: Partial<FolderFields>) {
  await getDb()
    .update(folders)
    .set({ ...fields, ...(fields.name ? { name: fields.name.trim() } : {}), updatedAt: Date.now() })
    .where(eq(folders.id, id));
}

export type DeletedFolder = {
  folderIds: string[];
  notes: { id: string; folderId: string | null }[];
};

/**
 * Borra (lógicamente) la carpeta y sus subcarpetas. Las notas que contenían no se pierden:
 * pasan a "sin carpeta". Devuelve lo necesario para deshacer.
 */
export async function deleteFolder(id: string, all: Folder[]): Promise<DeletedFolder> {
  const db = getDb();
  const folderIds = descendantIds(all, id);
  const affected = await db
    .select({ id: notes.id, folderId: notes.folderId })
    .from(notes)
    .where(inArray(notes.folderId, folderIds));
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(notes)
      .set({ folderId: null, updatedAt: now })
      .where(inArray(notes.folderId, folderIds))
      .run();
    tx.update(folders)
      .set({ deletedAt: now, updatedAt: now })
      .where(inArray(folders.id, folderIds))
      .run();
  });
  return { folderIds, notes: affected };
}

export async function restoreFolder({ folderIds, notes: affected }: DeletedFolder) {
  const db = getDb();
  const now = Date.now();
  db.transaction((tx) => {
    tx.update(folders)
      .set({ deletedAt: null, updatedAt: now })
      .where(inArray(folders.id, folderIds))
      .run();
    for (const note of affected) {
      tx.update(notes)
        .set({ folderId: note.folderId, updatedAt: now })
        .where(eq(notes.id, note.id))
        .run();
    }
  });
}
