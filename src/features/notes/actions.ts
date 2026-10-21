import type { Note, Tag } from '@/db/schema';
import { setTagOnNotes } from '@/features/tags/repository';
import { t } from '@/i18n';
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
    showSnackbar(favorite ? t('noteActions.favorited') : t('noteActions.unfavorited'));
  }
}

export async function changeColor(notes: Note[], color: NoteColor) {
  await setColor(ids(notes), color);
  if (notes.length > 1) {
    showUndo(t('noteActions.colorChanged', { count: notes.length }), async () => {
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
  showUndo(t('noteActions.archived', { count: notes.length }), async () => {
    await setArchived(ids(notes), false);
    await repin(notes);
  });
}

export async function unarchive(notes: Note[]) {
  await setArchived(ids(notes), false);
  showUndo(t('noteActions.unarchived', { count: notes.length }), () =>
    setArchived(ids(notes), true),
  );
}

export async function trash(notes: Note[]) {
  await moveToTrash(ids(notes));
  showUndo(t('noteActions.trashed', { count: notes.length }), async () => {
    await restoreFromTrash(ids(notes));
    await repin(notes);
  });
}

export async function restore(notes: Note[]) {
  await restoreFromTrash(ids(notes));
  showUndo(t('noteActions.restored', { count: notes.length }), () => moveToTrash(ids(notes)));
}

export async function deleteForever(notes: Note[]): Promise<boolean> {
  const ok = await confirm({
    title: t('noteActions.deleteForeverTitle'),
    message: t('noteActions.deleteForeverMessage', { count: notes.length }),
    confirmLabel: t('common.delete'),
    destructive: true,
  });
  if (ok) await deletePermanently(ids(notes));
  return ok;
}

export async function emptyTrashWithConfirm(count: number): Promise<boolean> {
  const ok = await confirm({
    title: t('trash.emptyTitle'),
    message: t('trash.emptyMessage', { count }),
    confirmLabel: t('trash.empty'),
    destructive: true,
  });
  if (ok) await emptyTrash();
  return ok;
}

export async function move(notes: Note[], folderId: string | null, folderName: string | null) {
  const moving = notes.filter((n) => n.folderId !== folderId);
  if (moving.length === 0) return;
  await moveToFolder(ids(moving), folderId);
  const message = folderName
    ? t('noteActions.movedTo', { count: moving.length, folder: folderName })
    : t('noteActions.movedOut', { count: moving.length });
  showUndo(message, async () => {
    for (const note of moving) await moveToFolder([note.id], note.folderId);
  });
}

export async function duplicate(note: Note) {
  const id = await duplicateNote(note.id);
  if (id) showSnackbar(t('noteActions.duplicated'));
  return id;
}

export async function convert(note: Note) {
  await convertNote(note.id, note.type === 'checklist' ? 'text' : 'checklist');
}
