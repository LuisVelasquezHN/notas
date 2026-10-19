import type { ChecklistItem, Reminder } from '@/db/schema';
import { setItemChecked } from '@/features/checklist/repository';
import { capabilities } from '@/lib/capabilities';
import { showSnackbar, showUndo } from '@/stores/snackbar-store';

import { formatReminder } from './format';
import { ensurePermission } from './notifications';
import {
  markReminderDone,
  removeReminder,
  restoreReminder,
  setItemDue,
  setNoteReminder,
  snoozeReminder,
  snoozeReminderUntil,
} from './repository';

/**
 * Acciones de usuario sobre recordatorios: llaman al repositorio, piden permiso de notificaciones
 * la primera vez y muestran el snackbar (con "Deshacer" cuando procede).
 */

/**
 * Pide permiso al crear el primer recordatorio y confirma con un snackbar. Si las notificaciones
 * están denegadas, el recordatorio se guarda igual y solo se ve en la app.
 */
async function confirmSaved(message: string) {
  if (capabilities.localNotifications && (await ensurePermission()) === 'denied') {
    showSnackbar('Notificaciones desactivadas: el recordatorio solo se verá en la app');
    return;
  }
  showSnackbar(message);
}

export async function saveNoteReminder(noteId: string, fireAt: number, rrule: string | null) {
  await setNoteReminder(noteId, fireAt, rrule);
  await confirmSaved(`Recordatorio: ${formatReminder(fireAt)}`);
}

export async function saveItemDue(item: Pick<ChecklistItem, 'id' | 'noteId'>, dueAt: number) {
  await setItemDue(item, dueAt);
  await confirmSaved(`Fecha límite: ${formatReminder(dueAt)}`);
}

export async function clearItemDue(item: Pick<ChecklistItem, 'id' | 'noteId'>, previous: number) {
  await setItemDue(item, null);
  showUndo('Fecha límite quitada', () => setItemDue(item, previous));
}

export async function remove(id: string) {
  const before = await removeReminder(id);
  if (before) showUndo('Recordatorio quitado', () => restoreReminder(before));
}

async function undoDone(before: Reminder) {
  await restoreReminder(before);
  // Un ítem con fecha límite se había marcado como completado.
  if (before.checklistItemId && !before.rrule) {
    await setItemChecked({ id: before.checklistItemId, noteId: before.noteId }, false);
  }
}

export async function done(id: string) {
  const before = await markReminderDone(id);
  if (!before) return;
  showUndo(before.rrule ? 'Hecho: pasa a la siguiente vez' : 'Recordatorio completado', () =>
    undoDone(before),
  );
}

export async function snooze(id: string, minutes: number) {
  const before = await snoozeReminder(id, minutes);
  if (!before) return;
  showUndo(`Pospuesto hasta ${formatReminder(Date.now() + minutes * 60_000)}`, () =>
    restoreReminder(before),
  );
}

export async function snoozeUntil(id: string, fireAt: number) {
  const before = await snoozeReminderUntil(id, fireAt);
  if (!before) return;
  showUndo(`Pospuesto hasta ${formatReminder(fireAt)}`, () => restoreReminder(before));
}
