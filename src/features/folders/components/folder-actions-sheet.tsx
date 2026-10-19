import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { Sheet, SheetItem, afterSheetClose } from '@/components/ui';
import { confirm } from '@/lib/confirm';
import { showUndo } from '@/stores/snackbar-store';

import { deleteFolder, foldersQuery, restoreFolder } from '../repository';
import { canHaveSubfolders, type FolderNode } from '../tree';

import type { FolderFormTarget } from './folder-form-sheet';

type FolderActionsSheetProps = {
  folder: FolderNode | null;
  onClose: () => void;
  onEdit: (target: FolderFormTarget) => void;
  onDeleted?: () => void;
};

export function FolderActionsSheet({
  folder,
  onClose,
  onEdit,
  onDeleted,
}: FolderActionsSheetProps) {
  const { data: all } = useLiveQuery(foldersQuery());

  async function remove(target: FolderNode) {
    const ok = await confirm({
      title: `¿Eliminar «${target.name}»?`,
      message:
        'Se eliminarán también sus subcarpetas. Las notas no se borran: pasan a "Sin carpeta".',
      confirmLabel: 'Eliminar',
      destructive: true,
    });
    if (!ok) return;
    const deleted = await deleteFolder(target.id, all);
    onDeleted?.();
    showUndo('Carpeta eliminada', () => restoreFolder(deleted));
  }

  return (
    <Sheet visible={folder !== null} onClose={onClose} title={folder?.name}>
      {folder ? (
        <>
          <SheetItem
            icon="edit"
            label="Editar"
            onPress={() => {
              onClose();
              afterSheetClose(() => onEdit({ mode: 'edit', folder }));
            }}
          />
          {canHaveSubfolders(folder.depth) ? (
            <SheetItem
              icon="folderAdd"
              label="Nueva subcarpeta"
              onPress={() => {
                onClose();
                afterSheetClose(() => onEdit({ mode: 'create', parentId: folder.id }));
              }}
            />
          ) : null}
          <SheetItem
            icon="trash"
            label="Eliminar"
            destructive
            onPress={() => {
              onClose();
              afterSheetClose(() => void remove(folder));
            }}
          />
        </>
      ) : null}
    </Sheet>
  );
}
