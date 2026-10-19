import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { ListControls } from '@/features/notes/components/list-controls';
import { NewNoteButtons } from '@/features/notes/components/new-note-buttons';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

export default function NotesScreen() {
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'active', sortBy }), [sortBy]);

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text variant="largeTitle">Notas</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="search"
            accessibilityLabel="Buscar"
            onPress={() => router.push('/search')}
          />
          <ListControls />
        </View>
      </View>

      <NoteList
        notes={notes}
        layout={layout}
        ListEmptyComponent={
          <EmptyState
            icon="note"
            title="Aún no tienes notas"
            description="Pulsa + para escribir una nota o el botón de lista para crear una checklist."
          />
        }
      />

      <NewNoteButtons />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
});
