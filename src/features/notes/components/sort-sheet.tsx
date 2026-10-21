import { useTranslation } from 'react-i18next';

import { Sheet, SheetItem, type IconName } from '@/components/ui';
import { useSettingsStore, type NotesSortBy } from '@/stores/settings-store';

const OPTIONS: { value: NotesSortBy; icon: IconName }[] = [
  { value: 'updatedAt', icon: 'edit' },
  { value: 'createdAt', icon: 'add' },
  { value: 'title', icon: 'text' },
  { value: 'manual', icon: 'dragHandle' },
];

export function SortSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const setSortBy = useSettingsStore((s) => s.setNotesSortBy);
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} title={t('sort.title')}>
      {OPTIONS.map((option) => (
        <SheetItem
          key={option.value}
          icon={option.icon}
          label={t(`sort.by.${option.value}`)}
          selected={sortBy === option.value}
          onPress={() => {
            setSortBy(option.value);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
