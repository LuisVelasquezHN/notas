import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useDeferredValue, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { EmptyState, IconButton, Screen, TextField } from '@/components/ui';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

export default function SearchScreen() {
  const { colors } = useTheme();
  const layout = useSettingsStore((s) => s.notesLayout);
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim());

  // Busca en notas activas y archivadas (no en la papelera).
  const { data: active } = useLiveQuery(notesQuery({ scope: 'active', search }), [search]);
  const { data: archived } = useLiveQuery(notesQuery({ scope: 'archived', search }), [search]);
  const results = search ? [...active, ...archived] : [];

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
      </View>
      <NoteList
        notes={results}
        layout={layout}
        ListEmptyComponent={
          search ? (
            <EmptyState
              icon="search"
              title="Sin resultados"
              description={`No hay notas que contengan «${search}».`}
            />
          ) : (
            <EmptyState
              icon="search"
              title="Buscar notas"
              description="Busca por título, contenido o elementos de una lista."
            />
          )
        }
      />
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
    paddingVertical: spacing.md,
  },
  input: { flex: 1 },
});
