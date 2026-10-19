import type { Note, Tag } from '@/db/schema';
import { setTagOnNotes } from '@/features/tags/repository';
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
  setFavorite,
  setPinned,
  updateNote,
} from './repository';

/**
 * Acciones de usuario sobre una o varias notas (selección múltiple): llaman al repositorio y
 * muestran el snackbar con "Deshacer". Las pantallas usan estas funciones, no el repositorio.
 */

const ids = (notes: Note[]) => notes.map((n) => n.id);

/** "Nota archivada" · "3 notas archivadas". */
function countLabel(notes: Note[], singular: string, plural: string) {
  return notes.length === 1 ? `Nota ${singular}` : `${notes.length} notas ${plural}`;
}

/** Vuelve a anclar las que estaban ancladas (archivar o tirar a la papelera las desancla). */
async function repin(notes: Note[]) {
  const pinned = notes.filter((n) => n.isPinned);
  for (const note of pinned) await updateNote(note.id, { isPinned: true, pinnedAt: note.pinnedAt });
}

/** Si todas están ancladas, las desancla; si no, ancla todas. */
export async function togglePin(notes: Note[]) {
  await setPinned(ids(notes), !notes.every((n) => n.isPinned));
}

export async function toggleFavorite(notes: Note[]) {
  const favorite = !notes.every((n) => n.isFavorite);
  await setFavorite(ids(notes), favorite);
  if (notes.length > 1) {
    showSnackbar(favorite ? 'Añadidas a favoritos' : 'Quitadas de favoritos');
  }
}

export async function changeColor(notes: Note[], color: NoteColor) {
  await setColor(ids(notes), color);
  if (notes.length > 1) {
    showUndo(`Color cambiado en ${notes.length} notas`, async () => {
      for (const note of notes) await setColor([note.id], note.color);
    });
  }
}

/** Si todas tienen la etiqueta, la quita; si no, se la pone a todas. */
export async function toggleTag(notes: Note[], tag: Tag, assignedToAll: boolean) {
  await setTagOnNotes(tag.id, ids(notes), !assignedToAll);
}

export async function archive(notes: Note[]) {
  await setArchived(ids(notes), true);
  showUndo(countLabel(notes, 'archivada', 'archivadas'), async () => {
    await setArchived(ids(notes), false);
    await repin(notes);
  });
}

export async function unarchive(notes: Note[]) {
  await setArchived(ids(notes), false);
  showUndo(
    notes.length === 1 ? 'Nota restaurada del archivo' : `${notes.length} notas desarchivadas`,
    () => setArchived(ids(notes), true),
  );
}

export async function trash(notes: Note[]) {
  await moveToTrash(ids(notes));
  showUndo(
    notes.length === 1 ? 'Nota movida a la papelera' : `${notes.length} notas en la papelera`,
    async () => {
      await restoreFromTrash(ids(notes));
      await repin(notes);
    },
  );
}

export async function restore(notes: Note[]) {
  await restoreFromTrash(ids(notes));
  showUndo(countLabel(notes, 'restaurada', 'restauradas'), () => moveToTrash(ids(notes)));
}

export async function deleteForever(notes: Note[]): Promise<boolean> {
  const one = notes.length === 1;
  const ok = await confirm({
    title: '¿Eliminar definitivamente?',
    message: `${one ? 'La nota se borrará' : `Las ${notes.length} notas se borrarán`} para siempre. Esta acción no se puede deshacer.`,
    confirmLabel: 'Eliminar',
    destructive: true,
  });
  if (ok) await deletePermanently(ids(notes));
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

export async function move(notes: Note[], folderId: string | null, folderName: string | null) {
  const moving = notes.filter((n) => n.folderId !== folderId);
  if (moving.length === 0) return;
  await moveToFolder(ids(moving), folderId);
  const what = moving.length === 1 ? 'Movida' : `${moving.length} notas movidas`;
  showUndo(folderName ? `${what} a «${folderName}»` : `${what} fuera de las carpetas`, async () => {
    for (const note of moving) await moveToFolder([note.id], note.folderId);
  });
}

export async function duplicate(note: Note) {
  const id = await duplicateNote(note.id);
  if (id) showSnackbar('Nota duplicada');
  return id;
}

export async function convert(note: Note) {
  await convertNote(note.id, note.type === 'checklist' ? 'text' : 'checklist');
}
