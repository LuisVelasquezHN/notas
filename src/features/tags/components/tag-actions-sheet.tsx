import { Sheet, SheetItem, afterSheetClose } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { confirm } from '@/lib/confirm';
import { showUndo } from '@/stores/snackbar-store';

import { deleteTag, restoreTag } from '../repository';

import type { TagFormTarget } from './tag-form-sheet';

type TagActionsSheetProps = {
  tag: Tag | null;
  onClose: () => void;
  onEdit: (target: TagFormTarget) => void;
  onDeleted?: () => void;
};

export function TagActionsSheet({ tag, onClose, onEdit, onDeleted }: TagActionsSheetProps) {
  async function remove(target: Tag) {
    const ok = await confirm({
      title: `¿Eliminar la etiqueta «${target.name}»?`,
      message: 'Las notas no se borran: solo pierden esta etiqueta.',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    await deleteTag(target.id);
    onDeleted?.();
    showUndo('Etiqueta eliminada', () => restoreTag(target.id));
  }

  return (
    <Sheet visible={tag !== null} onClose={onClose} title={tag?.name}>
      {tag ? (
        <>
          <SheetItem
            icon="edit"
            label="Editar"
            onPress={() => {
              onClose();
              afterSheetClose(() => onEdit({ mode: 'edit', tag }));
            }}
          />
          <SheetItem
            icon="trash"
            label="Eliminar"
            destructive
            onPress={() => {
              onClose();
              afterSheetClose(() => void remove(tag));
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}
