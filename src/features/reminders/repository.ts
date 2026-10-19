import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { checklistItems, notes, reminders, type ChecklistItem, type Reminder } from '@/db/schema';
import { setItemChecked } from '@/features/checklist/repository';
import { uuidv7 } from '@/lib/ids';

import { SNOOZE_MINUTES } from './format';
import { fireAtAfterDone, rolledForwardFireAt, type ActiveReminder } from './window';
import { deviceTimeZone } from './zoned-time';

/**
 * Recordatorios. Cada nota tiene como mucho un recordatorio propio (`checklist_item_id` nulo) y
 * cada ítem de checklist, uno para su fecha límite (reflejada en `checklist_items.due_at`).
 *
 * Estados: `scheduled` (pendiente), `snoozed` (pospuesto: `fire_at` es la hora pospuesta) y `done`.
 * Un recordatorio activo cuya hora ya pasó está "vencido". `fired` no se usa: la entrega de la
 * notificación no es fiable como señal; la base de datos es la fuente de verdad.
 *
 * La reprogramación de notificaciones no se llama desde aquí: el scheduler escucha los cambios
 * de la base de datos (ver `scheduler.ts`).
 */

const ACTIVE_STATUSES = ['scheduled', 'snoozed'] as const;

/** Activo: pendiente, de una nota fuera de la papelera y, si es de un ítem, sin completar. */
function activeCondition(): SQL {
  return and(
    isNull(reminders.deletedAt),
    inArray(reminders.status, ACTIVE_STATUSES),
    isNull(notes.deletedAt),
    or(
      isNull(reminders.checklistItemId),
      and(isNull(checklistItems.deletedAt), eq(checklistItems.isChecked, false)),
    ),
  )!;
}

/** Recordatorios activos con los datos de su nota e ítem, del más próximo al más lejano. */
export function activeRemindersQuery() {
  return getDb()
    .select({
      id: reminders.id,
      noteId: reminders.noteId,
      checklistItemId: reminders.checklistItemId,
      fireAt: reminders.fireAt,
      rrule: reminders.rrule,
      timezone: reminders.timezone,
      status: reminders.status,
      noteTitle: notes.title,
      noteText: notes.contentText,
      noteColor: notes.color,
      noteType: notes.type,
      isArchived: notes.isArchived,
      itemText: checklistItems.text,
    })
    .from(reminders)
    .innerJoin(notes, eq(notes.id, reminders.noteId))
    .leftJoin(checklistItems, eq(checklistItems.id, reminders.checklistItemId))
    .where(activeCondition())
    .orderBy(asc(reminders.fireAt));
}

export type ActiveReminderRow = Awaited<ReturnType<typeof activeRemindersQuery>>[number];

/** Recordatorio propio (no de un ítem) y activo de una nota. */
export function noteReminderQuery(noteId: string) {
  return getDb()
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.noteId, noteId),
        isNull(reminders.checklistItemId),
        isNull(reminders.deletedAt),
        inArray(reminders.status, ACTIVE_STATUSES),
      ),
    )
    .limit(1);
}

/** Recordatorios activos de los ítems de una nota (fechas límite). */
export function itemRemindersQuery(noteId: string) {
  return getDb()
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.noteId, noteId),
        isNull(reminders.deletedAt),
        inArray(reminders.status, ACTIVE_STATUSES),
      ),
    );
}

const firstLine = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';

/** Título y cuerpo de la notificación de un recordatorio. */
export function notificationContent(row: ActiveReminderRow): { title: string; body: string } {
  if (row.checklistItemId) {
    return { title: row.itemText?.trim() || 'Elemento de la lista', body: row.noteTitle.trim() };
  }
  const title = row.noteTitle.trim();
  const text = row.noteText.trim();
  if (title) return { title, body: text.slice(0, 180) };
  return { title: firstLine(text) || 'Recordatorio', body: '' };
}

/** Recordatorios activos listos para planificar la ventana de notificaciones. */
export async function loadActiveReminders(): Promise<ActiveReminder[]> {
  const rows = await activeRemindersQuery();
  return rows.map((row) => ({
    id: row.id,
    noteId: row.noteId,
    checklistItemId: row.checklistItemId,
    fireAt: row.fireAt,
    rrule: row.rrule,
    timezone: row.timezone,
    ...notificationContent(row),
  }));
}

/** Pone (o cambia) el recordatorio de una nota. `rrule`: texto de `buildRecurrence`. */
export async function setNoteReminder(noteId: string, fireAt: number, rrule: string | null) {
  const db = getDb();
  const now = Date.now();
  const [existing] = await noteReminderQuery(noteId);
  if (existing) {
    await db
      .update(reminders)
      .set({ fireAt, rrule, timezone: deviceTimeZone(), status: 'scheduled', updatedAt: now })
      .where(eq(reminders.id, existing.id));
    return existing.id;
  }
  const id = uuidv7(now);
  await db.insert(reminders).values({
    id,
    noteId,
    fireAt,
    rrule,
    timezone: deviceTimeZone(),
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Fecha límite de un ítem de checklist (con su recordatorio). `null` la quita. */
export async function setItemDue(item: Pick<ChecklistItem, 'id' | 'noteId'>, dueAt: number | null) {
  const db = getDb();
  const now = Date.now();
  const [existing] = await db
    .select()
    .from(reminders)
    .where(and(eq(reminders.checklistItemId, item.id), isNull(reminders.deletedAt)))
    .limit(1);
  db.transaction((tx) => {
    tx.update(checklistItems)
      .set({ dueAt, updatedAt: now })
      .where(eq(checklistItems.id, item.id))
      .run();
    if (dueAt === null) {
      if (existing) {
        tx.update(reminders)
          .set({ deletedAt: now, updatedAt: now })
          .where(eq(reminders.id, existing.id))
          .run();
      }
    } else if (existing) {
      tx.update(reminders)
        .set({ fireAt: dueAt, rrule: null, status: 'scheduled', updatedAt: now })
        .where(eq(reminders.id, existing.id))
        .run();
    } else {
      tx.insert(reminders)
        .values({
          id: uuidv7(now),
          noteId: item.noteId,
          checklistItemId: item.id,
          fireAt: dueAt,
          timezone: deviceTimeZone(),
          status: 'scheduled',
          createdAt: now,
          updatedAt: now,
        })
        .run();
    }
  });
}

async function getReminder(id: string): Promise<Reminder | undefined> {
  const [row] = await getDb().select().from(reminders).where(eq(reminders.id, id)).limit(1);
  return row;
}

/** Quita un recordatorio (borrado lógico). Devuelve el estado anterior para poder deshacer. */
export async function removeReminder(id: string): Promise<Reminder | undefined> {
  const before = await getReminder(id);
  if (!before) return undefined;
  const now = Date.now();
  await getDb()
    .update(reminders)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(reminders.id, id));
  if (before.checklistItemId) {
    await getDb()
      .update(checklistItems)
      .set({ dueAt: null, updatedAt: now })
      .where(eq(checklistItems.id, before.checklistItemId));
  }
  return before;
}

/** Vuelve a dejar un recordatorio como estaba (deshacer). */
export async function restoreReminder(snapshot: Reminder) {
  const now = Date.now();
  await getDb()
    .update(reminders)
    .set({
      fireAt: snapshot.fireAt,
      rrule: snapshot.rrule,
      status: snapshot.status,
      deletedAt: snapshot.deletedAt,
      updatedAt: now,
    })
    .where(eq(reminders.id, snapshot.id));
  if (snapshot.checklistItemId && snapshot.deletedAt === null) {
    await getDb()
      .update(checklistItems)
      .set({ dueAt: snapshot.fireAt, updatedAt: now })
      .where(eq(checklistItems.id, snapshot.checklistItemId));
  }
}

/**
 * Marca como hecho. Un recurrente pasa a su siguiente ocurrencia; uno puntual queda `done` (y si
 * es de un ítem, el ítem se marca como completado). Devuelve el estado anterior.
 */
export async function markReminderDone(id: string, now: number = Date.now()) {
  const before = await getReminder(id);
  if (!before || before.deletedAt !== null || before.status === 'done') return undefined;
  const next = fireAtAfterDone(before, now);
  const db = getDb();
  if (next !== null) {
    await db
      .update(reminders)
      .set({ fireAt: next, status: 'scheduled', updatedAt: now })
      .where(eq(reminders.id, id));
  } else {
    await db.update(reminders).set({ status: 'done', updatedAt: now }).where(eq(reminders.id, id));
    if (before.checklistItemId) {
      await setItemChecked({ id: before.checklistItemId, noteId: before.noteId }, true);
    }
  }
  return before;
}

/** Pospone `minutes` minutos desde ahora. Devuelve el estado anterior. */
export async function snoozeReminder(id: string, minutes: number = SNOOZE_MINUTES) {
  const before = await getReminder(id);
  if (!before || before.deletedAt !== null) return undefined;
  const now = Date.now();
  await getDb()
    .update(reminders)
    .set({ fireAt: now + minutes * 60_000, status: 'snoozed', updatedAt: now })
    .where(eq(reminders.id, id));
  return before;
}

/** Pospone hasta una hora concreta. */
export async function snoozeReminderUntil(id: string, fireAt: number) {
  const before = await getReminder(id);
  if (!before || before.deletedAt !== null) return undefined;
  await getDb()
    .update(reminders)
    .set({ fireAt, status: 'snoozed', updatedAt: Date.now() })
    .where(eq(reminders.id, id));
  return before;
}

/** Avanza los recurrentes vencidos a su ocurrencia pasada más reciente (ver `window.ts`). */
export async function rollForwardRecurring(now: number = Date.now()) {
  const db = getDb();
  const rows = await db
    .select()
    .from(reminders)
    .where(and(isNull(reminders.deletedAt), inArray(reminders.status, ACTIVE_STATUSES)));
  for (const row of rows) {
    const fireAt = rolledForwardFireAt(row, now);
    if (fireAt !== null) {
      await db
        .update(reminders)
        .set({ fireAt, status: 'scheduled', updatedAt: now })
        .where(eq(reminders.id, row.id));
    }
  }
}
