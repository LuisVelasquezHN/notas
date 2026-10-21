import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  async function remove(target: Tag) {
    const ok = await confirm({
      title: t('tags.deleteTitle', { name: target.name }),
      message: t('tags.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deleteTag(target.id);
    onDeleted?.();
    showUndo(t('tags.deleted'), () => restoreTag(target.id));
  }

  return (
    <Sheet visible={tag !== null} onClose={onClose} title={tag?.name}>
      {tag ? (
        <>
          <SheetItem
            icon="edit"
            label={t('common.edit')}
            onPress={() => {
              onClose();
              afterSheetClose(() => onEdit({ mode: 'edit', tag }));
            }}
          />
          <SheetItem
            icon="trash"
            label={t('common.delete')}
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
