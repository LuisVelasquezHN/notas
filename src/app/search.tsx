import { useEffect, useDeferredValue, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, Icon, IconButton, Screen, Text, TextField } from '@/components/ui';
import { GUEST_SCOPE } from '@/db/scope';
import { FilterBar } from '@/features/filters/components/filter-bar';
import { FilterSheet } from '@/features/filters/components/filter-sheet';
import {
  SmartFolderFormSheet,
  type SmartFolderFormTarget,
} from '@/features/filters/components/smart-folder-form-sheet';
import { isFilterEmpty, type NoteFilter } from '@/features/filters/filter';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import { NoteList } from '@/features/notes/components/note-list';
import { searchTerms } from '@/features/search/query';
import { useRecentSearches } from '@/features/search/recent-store';
import { useSyncStore } from '@/features/sync/store';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

/** Por defecto se busca también en el archivo (no en la papelera). */
const INITIAL_FILTER: NoteFilter = { includeArchived: true };
/** Una búsqueda se recuerda si se deja escrita este tiempo (o al pulsar Buscar). */
const REMEMBER_AFTER_MS = 2000;
const NO_RECENT: string[] = [];

export default function SearchScreen() {
  const { colors } = useTheme();
  const layout = useSettingsStore((s) => s.notesLayout);
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<NoteFilter>(INITIAL_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SmartFolderFormTarget | null>(null);
  const search = useDeferredValue(query.trim());

  const filter: NoteFilter = { ...criteria, search: search || undefined };
  const active = !isFilterEmpty(filter);
  const { data } = useFilteredNotes(filter);
  const results = active ? data : [];
  const terms = useMemo(() => searchTerms(search), [search]);

  const scope = useSyncStore((s) => s.scope) ?? GUEST_SCOPE;
  const recent = useRecentSearches((s) => s.byScope[scope] ?? NO_RECENT);
  const remember = useRef(() => {});
  useEffect(() => {
    remember.current = () => {
      if (search && results.length > 0) useRecentSearches.getState().add(scope, search);
    };
  });
  // Se recuerda lo que se queda escrito con resultados (y al salir de la pantalla).
  useEffect(() => {
    if (!search) return;
    const timer = setTimeout(() => remember.current(), REMEMBER_AFTER_MS);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => () => remember.current(), []);

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <View style={styles.searchBar}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('search.placeholder')}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => remember.current()}
          clearButtonMode="while-editing"
          accessibilityLabel={t('common.search')}
          testID="search-input"
          style={styles.input}
        />
        {/* iOS ya muestra su propio botón de borrar (`clearButtonMode`). */}
        {query && Platform.OS !== 'ios' ? (
          <IconButton
            icon="close"
            accessibilityLabel={t('search.clear')}
            color={colors.textSecondary}
            onPress={() => setQuery('')}
          />
        ) : null}
        {active ? (
          <IconButton
            icon="save"
            accessibilityLabel={t('search.saveAsSmart')}
            onPress={() => setSaveTarget({ mode: 'create', filter })}
          />
        ) : null}
      </View>

      <View style={styles.filters}>
        <FilterBar filter={criteria} onChange={setCriteria} onOpen={() => setFiltersOpen(true)} />
      </View>

      <NoteList
        notes={results}
        layout={layout}
        highlight={terms}
        ListHeaderComponent={
          !active && recent.length > 0 ? (
            <View style={styles.recent}>
              <View style={styles.recentHeader}>
                <Text variant="label" tone="secondary" style={styles.recentTitle}>
                  {t('search.recent')}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => useRecentSearches.getState().clear(scope)}
                  hitSlop={8}>
                  <Text variant="label" tone="primary">
                    {t('search.clearRecent')}
                  </Text>
                </Pressable>
              </View>
              {recent.map((value) => (
                <View key={value} style={styles.recentRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('search.searchFor', { search: value })}
                    onPress={() => setQuery(value)}
                    style={({ pressed }) => [styles.recentItem, pressed && { opacity: 0.6 }]}>
                    <Icon name="clock" size={18} color={colors.textMuted} />
                    <Text numberOfLines={1} style={styles.recentText}>
                      {value}
                    </Text>
                  </Pressable>
                  <IconButton
                    icon="close"
                    size={18}
                    accessibilityLabel={t('search.removeRecent', { search: value })}
                    color={colors.textMuted}
                    onPress={() => useRecentSearches.getState().remove(scope, value)}
                  />
                </View>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          active ? (
            <EmptyState
              icon="search"
              title={t('search.noResults')}
              description={
                search ? t('search.noResultsFor', { search }) : t('search.noResultsFilters')
              }
            />
          ) : recent.length > 0 ? null : (
            <EmptyState icon="search" title={t('search.idle')} description={t('search.idleHint')} />
          )
        }
      />

      <FilterSheet
        visible={filtersOpen}
        filter={criteria}
        onChange={setCriteria}
        onClose={() => setFiltersOpen(false)}
        resultCount={active ? results.length : undefined}
      />
      <SmartFolderFormSheet target={saveTarget} onClose={() => setSaveTarget(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  input: { flex: 1 },
  filters: { paddingBottom: spacing.sm },
  recent: { paddingHorizontal: spacing.xs, paddingBottom: spacing.md },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  recentTitle: { textTransform: 'uppercase' },
  recentRow: { flexDirection: 'row', alignItems: 'center' },
  recentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
  },
  recentText: { flex: 1 },
});
