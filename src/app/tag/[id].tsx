import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyState, IconButton, Screen } from '@/components/ui';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import { ListControls } from '@/features/notes/components/list-controls';
import { NewNoteButtons } from '@/features/notes/components/new-note-buttons';
import { NoteList } from '@/features/notes/components/note-list';
import { TagActionsSheet } from '@/features/tags/components/tag-actions-sheet';
import { TagFormSheet, type TagFormTarget } from '@/features/tags/components/tag-form-sheet';
import { TagPill } from '@/features/tags/components/tag-pill';
import { tagQuery } from '@/features/tags/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

/** Notas con una etiqueta. */
export default function TagScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { data, updatedAt } = useLiveQuery(tagQuery(id), [id]);
  const tag = data[0];
  const { data: notes } = useFilteredNotes({ tagIds: [id] }, { sortBy });
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState<TagFormTarget | null>(null);

  if (!tag) {
    return (
      <Screen edges={[]}>
        <Stack.Screen options={{ title: '' }} />
        {updatedAt ? <EmptyState icon="tag" title="Etiqueta no encontrada" /> : null}
      </Screen>
    );
  }

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <Stack.Screen
        options={{
          headerTitle: () => <TagPill tag={tag} />,
          headerRight: () => (
            <View style={styles.headerActions}>
              <ListControls />
              <IconButton
                icon="more"
                accessibilityLabel="Opciones de la etiqueta"
                onPress={() => setMenuOpen(true)}
              />
            </View>
          ),
        }}
      />

      <NoteList
        notes={notes}
        layout={layout}
        reorderable
        ListEmptyComponent={
          <EmptyState
            icon="tag"
            title="Ninguna nota con esta etiqueta"
            description="Mantén pulsada una nota y elige «Etiquetas», o crea una nota aquí."
          />
        }
      />

      <NewNoteButtons tagId={tag.id} />

      <TagActionsSheet
        tag={menuOpen ? tag : null}
        onClose={() => setMenuOpen(false)}
        onEdit={setForm}
        onDeleted={() => (router.canGoBack() ? router.back() : router.replace('/folders'))}
      />
      <TagFormSheet target={form} onClose={() => setForm(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: spacing.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
});
