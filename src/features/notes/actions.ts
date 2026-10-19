import type { Note } from '@/db/schema';
import { confirm } from '@/lib/confirm';
import { showSnackbar, showUndo } from '@/stores/snackbar-store';
import type { NoteColor } from '@/theme/tokens';

import {
  convertNote,
  deletePermanently,
  duplicateNote,
  emptyTrash,
  moveToFolder,
  moveToTrash,
  restoreFromTrash,
  setArchived,
  setColor,
  setPinned,
} from './repository';

/**
 * Acciones de usuario sobre notas: llaman al repositorio y muestran el snackbar con "Deshacer".
 * Las pantallas usan estas funciones, no el repositorio directamente.
 */

export async function togglePin(note: Note) {
  await setPinned([note.id], !note.isPinned);
}

export async function changeColor(note: Note, color: NoteColor) {
  await setColor([note.id], color);
}

export async function archive(note: Note) {
  await setArchived([note.id], true);
  showUndo('Nota archivada', async () => {
    await setArchived([note.id], false);
    if (note.isPinned) await setPinned([note.id], true);
  });
}

export async function unarchive(note: Note) {
  await setArchived([note.id], false);
  showUndo('Nota restaurada del archivo', () => setArchived([note.id], true));
}

export async function trash(note: Note) {
  await moveToTrash([note.id]);
  showUndo('Nota movida a la papelera', async () => {
    await restoreFromTrash([note.id]);
    if (note.isPinned) await setPinned([note.id], true);
  });
}

export async function restore(note: Note) {
  await restoreFromTrash([note.id]);
  showUndo('Nota restaurada', () => moveToTrash([note.id]));
}

export async function deleteForever(note: Note): Promise<boolean> {
  const ok = await confirm({
    title: '¿Eliminar definitivamente?',
    message: 'La nota se borrará para siempre. Esta acción no se puede deshacer.',
    confirmLabel: 'Eliminar',
    destructive: true,
  });
  if (ok) await deletePermanently([note.id]);
  return ok;
}

export async function emptyTrashWithConfirm(count: number): Promise<boolean> {
  const ok = await confirm({
    title: '¿Vaciar la papelera?',
    message: `Se eliminarán definitivamente ${count === 1 ? '1 nota' : `${count} notas`}.`,
    confirmLabel: 'Vaciar',
    destructive: true,
  });
  if (ok) await emptyTrash();
  return ok;
}

export async function move(note: Note, folderId: string | null, folderName: string | null) {
  if (note.folderId === folderId) return;
  await moveToFolder([note.id], folderId);
  showUndo(folderName ? `Movida a «${folderName}»` : 'Movida fuera de las carpetas', () =>
    moveToFolder([note.id], note.folderId),
  );
}

export async function duplicate(note: Note) {
  const id = await duplicateNote(note.id);
  if (id) showSnackbar('Nota duplicada');
  return id;
}

export async function convert(note: Note) {
  await convertNote(note.id, note.type === 'checklist' ? 'text' : 'checklist');
}
