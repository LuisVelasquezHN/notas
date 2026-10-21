import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import {
  EmptyState,
  Icon,
  IconButton,
  Screen,
  Sheet,
  SheetItem,
  Text,
  afterSheetClose,
  isIconName,
} from '@/components/ui';
import { FilterBar } from '@/features/filters/components/filter-bar';
import { FilterSheet } from '@/features/filters/components/filter-sheet';
import {
  SmartFolderFormSheet,
  type SmartFolderFormTarget,
} from '@/features/filters/components/smart-folder-form-sheet';
import { isFilterEmpty, parseFilter, type NoteFilter } from '@/features/filters/filter';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import {
  deleteSavedFilter,
  restoreSavedFilter,
  savedFilterQuery,
  updateSavedFilter,
} from '@/features/filters/repository';
import { ListControls } from '@/features/notes/components/list-controls';
import { NoteList } from '@/features/notes/components/note-list';
import { confirm } from '@/lib/confirm';
import { useSettingsStore } from '@/stores/settings-store';
import { showUndo } from '@/stores/snackbar-store';
import { spacing, useTheme } from '@/theme';

/** Carpeta inteligente: las notas que cumplen un filtro guardado. Los filtros se editan aquí. */
export default function SmartFolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { data, updatedAt } = useLiveQuery(savedFilterQuery(id), [id]);
  const saved = data[0];
  const filter = useMemo(() => parseFilter(saved?.queryJson), [saved?.queryJson]);
  const { data: notes } = useFilteredNotes(filter, { sortBy });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<SmartFolderFormTarget | null>(null);

  if (!saved) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        {updatedAt ? <EmptyState icon="smartFolder" title={t('smart.notFound')} /> : null}
      </Screen>
    );
  }

  const change = (next: NoteFilter) => void updateSavedFilter(saved.id, { filter: next });

  async function remove() {
    const ok = await confirm({
      title: t('smart.deleteTitle', { name: saved.name }),
      message: t('smart.deleteMessage'),
      confirmLabel: t('common.delete'),
      destructive: true,
    });
    if (!ok) return;
    await deleteSavedFilter(saved.id);
    if (router.canGoBack()) router.back();
    else router.replace('/folders');
    showUndo(t('smart.deleted'), () => restoreSavedFilter(saved.id));
  }

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.title}>
              <Icon
                name={isIconName(saved.icon) ? saved.icon : 'smartFolder'}
                size={20}
                color={colors.textSecondary}
              />
              <Text variant="heading" numberOfLines={1}>
                {saved.name}
              </Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <ListControls />
              <IconButton
                icon="more"
                accessibilityLabel={t('smart.options')}
                onPress={() => setMenuOpen(true)}
              />
            </View>
          ),
        }}
      />

      <View style={styles.filters}>
        <FilterBar filter={filter} onChange={change} onOpen={() => setFiltersOpen(true)} />
      </View>

      <NoteList
        notes={notes}
        layout={layout}
        reorderable
        ListEmptyComponent={
          <EmptyState
            icon="smartFolder"
            title={isFilterEmpty(filter) ? t('smart.noFilters') : t('smart.noMatches')}
            description={
              isFilterEmpty(filter) ? t('smart.noFiltersHint') : t('smart.noMatchesHint')
            }
          />
        }
      />

      <FilterSheet
        visible={filtersOpen}
        filter={filter}
        onChange={change}
        onClose={() => setFiltersOpen(false)}
        resultCount={notes.length}
      />
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title={saved.name}>
        <SheetItem
          icon="filter"
          label={t('smart.editFilters')}
          onPress={() => {
            setMenuOpen(false);
            afterSheetClose(() => setFiltersOpen(true));
          }}
        />
        <SheetItem
          icon="edit"
          label={t('smart.nameAndIcon')}
          onPress={() => {
            setMenuOpen(false);
            afterSheetClose(() => setForm({ mode: 'edit', saved }));
          }}
        />
        <SheetItem
          icon="trash"
          label={t('common.delete')}
          destructive
          onPress={() => {
            setMenuOpen(false);
            afterSheetClose(() => void remove());
          }}
        />
      </Sheet>
      <SmartFolderFormSheet target={form} onClose={() => setForm(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: spacing.sm },
  filters: { paddingBottom: spacing.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 220 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
});
