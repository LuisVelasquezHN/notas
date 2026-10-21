import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/components/ui';
import { foldersQuery } from '@/features/folders/repository';
import { tagsQuery } from '@/features/tags/repository';
import { spacing } from '@/theme';

import { activeCriteriaCount, describeFilter, type NoteFilter } from '../filter';

type FilterBarProps = {
  filter: NoteFilter;
  onChange: (filter: NoteFilter) => void;
  onOpen: () => void;
};

/** Botón "Filtros" seguido de un chip por cada criterio activo (tocarlo lo quita). */
export function FilterBar({ filter, onChange, onOpen }: FilterBarProps) {
  const { t } = useTranslation();
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: folders } = useLiveQuery(foldersQuery());
  const parts = useMemo(() => {
    const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));
    const folderNames = new Map(folders.map((f) => [f.id, f.name]));
    return describeFilter(
      filter,
      { tag: (id) => tagNames.get(id), folder: (id) => folderNames.get(id) },
      t,
    );
  }, [filter, tags, folders, t]);
  const count = activeCriteriaCount(filter);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}>
      <Chip
        label={count > 0 ? t('filters.titleCount', { count }) : t('filters.title')}
        icon="filter"
        selected={count > 0}
        onPress={onOpen}
      />
      {parts.map((part) => (
        <Chip
          key={part.key}
          label={part.label}
          icon="close"
          accessibilityLabel={t('filters.removeFilter', { label: part.label })}
          onPress={() => onChange(part.without)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
});
