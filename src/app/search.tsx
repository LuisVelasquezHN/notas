import { useDeferredValue, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { EmptyState, IconButton, Screen, TextField } from '@/components/ui';
import { FilterBar } from '@/features/filters/components/filter-bar';
import { FilterSheet } from '@/features/filters/components/filter-sheet';
import {
  SmartFolderFormSheet,
  type SmartFolderFormTarget,
} from '@/features/filters/components/smart-folder-form-sheet';
import { isFilterEmpty, type NoteFilter } from '@/features/filters/filter';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import { NoteList } from '@/features/notes/components/note-list';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

/** Por defecto se busca también en el archivo (no en la papelera). */
const INITIAL_FILTER: NoteFilter = { includeArchived: true };

export default function SearchScreen() {
  const { colors } = useTheme();
  const layout = useSettingsStore((s) => s.notesLayout);
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<NoteFilter>(INITIAL_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<SmartFolderFormTarget | null>(null);
  const search = useDeferredValue(query.trim());

  const filter: NoteFilter = { ...criteria, search: search || undefined };
  const active = !isFilterEmpty(filter);
  const { data } = useFilteredNotes(filter);
  const results = active ? data : [];

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <View style={styles.searchBar}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar en títulos, notas y listas"
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar"
          style={styles.input}
        />
        {/* iOS ya muestra su propio botón de borrar (`clearButtonMode`). */}
        {query && Platform.OS !== 'ios' ? (
          <IconButton
            icon="close"
            accessibilityLabel="Borrar búsqueda"
            color={colors.textSecondary}
            onPress={() => setQuery('')}
          />
        ) : null}
        {active ? (
          <IconButton
            icon="save"
            accessibilityLabel="Guardar como carpeta inteligente"
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
        ListEmptyComponent={
          active ? (
            <EmptyState
              icon="search"
              title="Sin resultados"
              description={
                search
                  ? `No hay notas que contengan «${search}» con estos filtros.`
                  : 'Ninguna nota cumple estos filtros.'
              }
            />
          ) : (
            <EmptyState
              icon="search"
              title="Buscar notas"
              description="Busca por título, contenido o elementos de una lista, o combina filtros por tipo, color, etiqueta, carpeta y fecha."
            />
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
});
