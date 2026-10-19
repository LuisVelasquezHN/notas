import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Chip, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { FolderActionsSheet } from '@/features/folders/components/folder-actions-sheet';
import {
  FolderFormSheet,
  type FolderFormTarget,
} from '@/features/folders/components/folder-form-sheet';
import { FolderIcon } from '@/features/folders/components/folder-row';
import { foldersQuery } from '@/features/folders/repository';
import { buildFolderTree, flattenFolderTree, folderPath } from '@/features/folders/tree';
import { ListControls } from '@/features/notes/components/list-controls';
import { NewNoteButtons } from '@/features/notes/components/new-note-buttons';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

export default function FolderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { data: folders, updatedAt } = useLiveQuery(foldersQuery());
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'active', folderId: id, sortBy }), [
    id,
    sortBy,
  ]);
  const [form, setForm] = useState<FolderFormTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const node = useMemo(
    () => flattenFolderTree(buildFolderTree(folders)).find((f) => f.id === id) ?? null,
    [folders, id],
  );
  const path = useMemo(() => folderPath(folders, id).slice(0, -1), [folders, id]);

  if (!node) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        {updatedAt ? <EmptyState icon="folder" title="Carpeta no encontrada" /> : null}
      </Screen>
    );
  }

  const header = (
    <View style={styles.header}>
      {path.length > 0 ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {path.map((f) => f.name).join(' › ')}
        </Text>
      ) : null}
      {node.children.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}>
          {node.children.map((child) => (
            <Chip
              key={child.id}
              label={child.name}
              icon="folder"
              onPress={() => router.push({ pathname: '/folder/[id]', params: { id: child.id } })}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.title}>
              <FolderIcon icon={node.icon} color={node.color} size={28} />
              <Text variant="heading" numberOfLines={1}>
                {node.name}
              </Text>
            </View>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <ListControls />
              <IconButton
                icon="more"
                accessibilityLabel="Opciones de la carpeta"
                onPress={() => setMenuOpen(true)}
              />
            </View>
          ),
        }}
      />

      <NoteList
        notes={notes}
        layout={layout}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="note"
            title="Carpeta vacía"
            description="Crea una nota aquí o mueve notas desde su menú (mantén pulsada una nota)."
          />
        }
      />

      <NewNoteButtons folderId={node.id} />

      <FolderActionsSheet
        folder={menuOpen ? node : null}
        onClose={() => setMenuOpen(false)}
        onEdit={setForm}
        onDeleted={() => (router.canGoBack() ? router.back() : router.replace('/folders'))}
      />
      <FolderFormSheet
        target={form}
        onClose={() => setForm(null)}
        onSaved={(created) => {
          if (created) router.push({ pathname: '/folder/[id]', params: { id: created.id } });
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: spacing.sm },
  header: { gap: spacing.sm, paddingBottom: spacing.sm },
  chips: { gap: spacing.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, maxWidth: 220 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
});
