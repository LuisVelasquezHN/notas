import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState, Fab, Icon, IconButton, Screen, Text } from '@/components/ui';
import type { Note } from '@/db';
import { activeNotesQuery, createNote } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { radius, spacing, useTheme } from '@/theme';

export default function NotesScreen() {
  const { data: notes } = useLiveQuery(activeNotesQuery());
  const layout = useSettingsStore((s) => s.notesLayout);
  const setLayout = useSettingsStore((s) => s.setNotesLayout);

  async function handleCreate() {
    const note = await createNote('text');
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="largeTitle">Notas</Text>
        <View style={styles.headerActions}>
          <IconButton
            icon="search"
            accessibilityLabel="Buscar"
            onPress={() => router.push('/search')}
          />
          <IconButton
            icon={layout === 'grid' ? 'list' : 'grid'}
            accessibilityLabel={layout === 'grid' ? 'Ver como lista' : 'Ver como cuadrícula'}
            onPress={() => setLayout(layout === 'grid' ? 'list' : 'grid')}
          />
        </View>
      </View>

      <FlatList
        key={layout}
        data={notes}
        keyExtractor={(note) => note.id}
        numColumns={layout === 'grid' ? 2 : 1}
        columnWrapperStyle={layout === 'grid' ? styles.row : undefined}
        contentContainerStyle={[styles.list, notes.length === 0 && styles.listEmpty]}
        renderItem={({ item }) => <NotePreview note={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="note"
            title="Aún no tienes notas"
            description="Pulsa + para crear tu primera nota."
          />
        }
      />

      <Fab accessibilityLabel="Nueva nota" onPress={handleCreate} />
    </Screen>
  );
}

/** Tarjeta provisional; la definitiva (vista previa, checklist, iconos) llega en la fase 1. */
function NotePreview({ note }: { note: Note }) {
  const { colors, noteColor } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: noteColor(note.color),
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <View style={styles.cardHeader}>
        <Text variant="bodyStrong" numberOfLines={2} style={styles.cardTitle}>
          {note.title || 'Sin título'}
        </Text>
        {note.isPinned ? <Icon name="pin" size={16} color={colors.textSecondary} /> : null}
      </View>
      {note.contentText ? (
        <Text tone="secondary" numberOfLines={6}>
          {note.contentText}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  headerActions: { flexDirection: 'row', gap: spacing.xs },
  list: { gap: spacing.sm, paddingBottom: 120 },
  listEmpty: { flexGrow: 1 },
  row: { gap: spacing.sm },
  card: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  cardTitle: { flex: 1 },
});
