import { and, asc, eq, gt, isNull } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { checklistItems, notes, type ChecklistItem } from '@/db/schema';
import { uuidv7 } from '@/lib/ids';
import { sortKeyBetween } from '@/lib/sort-key';

/** Máxima sangría de un ítem (0 = tarea, 1 = subtarea). */
export const MAX_INDENT = 1;

/** Ítems visibles de una nota: pendientes primero y, dentro de cada grupo, en orden manual. */
export function checklistItemsQuery(noteId: string) {
  return getDb()
    .select()
    .from(checklistItems)
    .where(and(eq(checklistItems.noteId, noteId), isNull(checklistItems.deletedAt)))
    .orderBy(asc(checklistItems.isChecked), asc(checklistItems.sortKey));
}

/** Todos los ítems visibles, para las vistas previas de las tarjetas. */
export function allChecklistItemsQuery() {
  return getDb()
    .select({
      id: checklistItems.id,
      noteId: checklistItems.noteId,
      text: checklistItems.text,
      isChecked: checklistItems.isChecked,
      indent: checklistItems.indent,
    })
    .from(checklistItems)
    .where(isNull(checklistItems.deletedAt))
    .orderBy(asc(checklistItems.isChecked), asc(checklistItems.sortKey));
}

export type ChecklistPreviewItem = Pick<
  ChecklistItem,
  'id' | 'noteId' | 'text' | 'isChecked' | 'indent'
>;

/**
 * Recalcula el texto plano de la nota (vista previa y búsqueda) y su fecha de modificación.
 * Los pendientes van primero, igual que en el editor.
 */
async function syncNoteText(noteId: string) {
  const db = getDb();
  const items = await checklistItemsQuery(noteId);
  await db
    .update(notes)
    .set({ contentText: items.map((i) => i.text).join('\n'), updatedAt: Date.now() })
    .where(eq(notes.id, noteId));
}

/**
 * Clave de orden justo después de `afterKey` (`null` = al principio). El vecino siguiente se busca
 * entre TODOS los ítems de la nota (pendientes, completados y borrados), así las claves nunca se
 * repiten aunque pendientes y completados se muestren por separado.
 */
async function keyAfter(noteId: string, afterKey: string | null, excludeId?: string) {
  const rows = await getDb()
    .select({ id: checklistItems.id, sortKey: checklistItems.sortKey })
    .from(checklistItems)
    .where(
      and(
        eq(checklistItems.noteId, noteId),
        afterKey === null ? undefined : gt(checklistItems.sortKey, afterKey),
      ),
    )
    .orderBy(asc(checklistItems.sortKey))
    .limit(2);
  const next = rows.find((r) => r.id !== excludeId)?.sortKey ?? null;
  return sortKeyBetween(afterKey, next);
}

/** Crea un ítem justo después de la clave `afterKey` (`null` = al principio). */
export async function addItem(
  noteId: string,
  afterKey: string | null,
  { text = '', indent = 0 }: { text?: string; indent?: number } = {},
) {
  const now = Date.now();
  const [item] = await getDb()
    .insert(checklistItems)
    .values({
      id: uuidv7(now),
      noteId,
      text,
      indent,
      sortKey: await keyAfter(noteId, afterKey),
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await syncNoteText(noteId);
  return item;
}

export async function updateItemText(item: Pick<ChecklistItem, 'id' | 'noteId'>, text: string) {
  await getDb()
    .update(checklistItems)
    .set({ text, updatedAt: Date.now() })
    .where(eq(checklistItems.id, item.id));
  await syncNoteText(item.noteId);
}

export async function setItemChecked(item: Pick<ChecklistItem, 'id' | 'noteId'>, checked: boolean) {
  const now = Date.now();
  await getDb()
    .update(checklistItems)
    .set({ isChecked: checked, checkedAt: checked ? now : null, updatedAt: now })
    .where(eq(checklistItems.id, item.id));
  await syncNoteText(item.noteId);
}

export async function setItemIndent(item: Pick<ChecklistItem, 'id' | 'noteId'>, indent: number) {
  await getDb()
    .update(checklistItems)
    .set({ indent: Math.max(0, Math.min(MAX_INDENT, indent)), updatedAt: Date.now() })
    .where(eq(checklistItems.id, item.id));
}

/** Mueve el ítem justo después de la clave `afterKey` (`null` = al principio). */
export async function moveItem(
  item: Pick<ChecklistItem, 'id' | 'noteId'>,
  afterKey: string | null,
) {
  await getDb()
    .update(checklistItems)
    .set({ sortKey: await keyAfter(item.noteId, afterKey, item.id), updatedAt: Date.now() })
    .where(eq(checklistItems.id, item.id));
  await syncNoteText(item.noteId);
}

/** Borrado lógico: permite deshacer. La purga física ocurre con la de la papelera. */
export async function deleteItem(item: Pick<ChecklistItem, 'id' | 'noteId'>) {
  const now = Date.now();
  await getDb()
    .update(checklistItems)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(checklistItems.id, item.id));
  await syncNoteText(item.noteId);
}

export async function restoreItem(item: Pick<ChecklistItem, 'id' | 'noteId'>) {
  await getDb()
    .update(checklistItems)
    .set({ deletedAt: null, updatedAt: Date.now() })
    .where(eq(checklistItems.id, item.id));
  await syncNoteText(item.noteId);
}

/** Desmarca todos los completados (útil para listas que se reutilizan, como la compra). */
export async function uncheckAll(noteId: string) {
  await getDb()
    .update(checklistItems)
    .set({ isChecked: false, checkedAt: null, updatedAt: Date.now() })
    .where(
      and(
        eq(checklistItems.noteId, noteId),
        eq(checklistItems.isChecked, true),
        isNull(checklistItems.deletedAt),
      ),
    );
  await syncNoteText(noteId);
}

/** Borra (de forma lógica) todos los completados; devuelve sus IDs para poder deshacer. */
export async function deleteCheckedItems(noteId: string) {
  const db = getDb();
  const now = Date.now();
  const removed = await db
    .update(checklistItems)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(checklistItems.noteId, noteId),
        eq(checklistItems.isChecked, true),
        isNull(checklistItems.deletedAt),
      ),
    )
    .returning({ id: checklistItems.id });
  await syncNoteText(noteId);
  return removed.map((r) => r.id);
}

export async function restoreItems(noteId: string, ids: string[]) {
  for (const id of ids) {
    await getDb()
      .update(checklistItems)
      .set({ deletedAt: null, updatedAt: Date.now() })
      .where(eq(checklistItems.id, id));
  }
  await syncNoteText(noteId);
}
