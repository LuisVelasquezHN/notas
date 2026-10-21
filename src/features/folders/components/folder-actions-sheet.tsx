import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  const { data: all } = useLiveQuery(foldersQuery());

  async function remove(target: FolderNode) {
    const ok = await confirm({
      title: t('folders.deleteTitle', { name: target.name }),
      message: t('folders.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    const deleted = await deleteFolder(target.id, all);
    onDeleted?.();
    showUndo(t('folders.deleted'), () => restoreFolder(deleted));
  }

  return (
    <Sheet visible={folder !== null} onClose={onClose} title={folder?.name}>
      {folder ? (
        <>
          <SheetItem
            icon="edit"
            label={t('common.edit')}
            onPress={() => {
              onClose();
              afterSheetClose(() => onEdit({ mode: 'edit', folder }));
            }}
          />
          {canHaveSubfolders(folder.depth) ? (
            <SheetItem
              icon="folderAdd"
              label={t('folders.newSubfolder')}
              onPress={() => {
                onClose();
                afterSheetClose(() => onEdit({ mode: 'create', parentId: folder.id }));
              }}
            />
          ) : null}
          <SheetItem
            icon="trash"
            label={t('common.delete')}
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
