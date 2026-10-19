import { and, asc, desc, eq, isNull } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { savedFilters } from '@/db/schema';
import { uuidv7 } from '@/lib/ids';
import { sortKeyAfter } from '@/lib/sort-key';

import { serializeFilter, type NoteFilter } from './filter';

/** Carpetas inteligentes: filtros guardados con nombre e icono. */
export function savedFiltersQuery() {
  return getDb()
    .select()
    .from(savedFilters)
    .where(isNull(savedFilters.deletedAt))
    .orderBy(asc(savedFilters.sortKey));
}

export function savedFilterQuery(id: string) {
  return getDb()
    .select()
    .from(savedFilters)
    .where(and(eq(savedFilters.id, id), isNull(savedFilters.deletedAt)))
    .limit(1);
}

export type SavedFilterFields = { name: string; icon: string | null; filter: NoteFilter };

export async function createSavedFilter({ name, icon, filter }: SavedFilterFields) {
  const db = getDb();
  const [last] = await db
    .select({ sortKey: savedFilters.sortKey })
    .from(savedFilters)
    .orderBy(desc(savedFilters.sortKey))
    .limit(1);
  const now = Date.now();
  const [saved] = await db
    .insert(savedFilters)
    .values({
      id: uuidv7(now),
      name: name.trim(),
      icon,
      queryJson: serializeFilter(filter),
      sortKey: sortKeyAfter(last?.sortKey ?? null),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return saved;
}

export async function updateSavedFilter(id: string, fields: Partial<SavedFilterFields>) {
  const { filter, name, ...rest } = fields;
  await getDb()
    .update(savedFilters)
    .set({
      ...rest,
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(filter ? { queryJson: serializeFilter(filter) } : {}),
      updatedAt: Date.now(),
    })
    .where(eq(savedFilters.id, id));
}

export async function deleteSavedFilter(id: string) {
  const now = Date.now();
  await getDb()
    .update(savedFilters)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(savedFilters.id, id));
}

export async function restoreSavedFilter(id: string) {
  await getDb()
    .update(savedFilters)
    .set({ deletedAt: null, updatedAt: Date.now() })
    .where(eq(savedFilters.id, id));
}
