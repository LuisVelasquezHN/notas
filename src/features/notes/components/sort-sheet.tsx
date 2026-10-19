import { Sheet, SheetItem, type IconName } from '@/components/ui';
import { useSettingsStore, type NotesSortBy } from '@/stores/settings-store';

const OPTIONS: { value: NotesSortBy; label: string; icon: IconName }[] = [
  { value: 'updatedAt', label: 'Fecha de modificación', icon: 'edit' },
  { value: 'createdAt', label: 'Fecha de creación', icon: 'add' },
  { value: 'title', label: 'Título (A–Z)', icon: 'text' },
  { value: 'manual', label: 'Manual (arrastrar)', icon: 'dragHandle' },
];

export function SortSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const setSortBy = useSettingsStore((s) => s.setNotesSortBy);
  return (
    <Sheet visible={visible} onClose={onClose} title="Ordenar por">
      {OPTIONS.map((option) => (
        <SheetItem
          key={option.value}
          icon={option.icon}
          label={option.label}
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
