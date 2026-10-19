import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components/ui';
import { emptyTrashWithConfirm } from '@/features/notes/actions';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { TRASH_RETENTION_DAYS, daysLeftInTrash } from '@/lib/dates';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

export default function TrashScreen() {
  const layout = useSettingsStore((s) => s.notesLayout);
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'trash' }));

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () =>
            notes.length > 0 ? (
              <Button
                title="Vaciar"
                variant="ghost"
                onPress={() => void emptyTrashWithConfirm(notes.length)}
              />
            ) : null,
        }}
      />
      <NoteList
        notes={notes}
        layout={layout}
        meta={(note) => {
          const days = daysLeftInTrash(note.deletedAt ?? Date.now());
          return days <= 1 ? 'Se elimina hoy' : `Se elimina en ${days} días`;
        }}
        ListHeaderComponent={
          notes.length > 0 ? (
            <View style={styles.hint}>
              <Text variant="caption" tone="secondary">
                Las notas se eliminan definitivamente {TRASH_RETENTION_DAYS} días después de
                moverlas aquí. Mantén pulsada una nota para seleccionarla y restaurarla.
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="trash"
            title="Papelera vacía"
            description={`Las notas eliminadas se guardan aquí ${TRASH_RETENTION_DAYS} días.`}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, paddingTop: spacing.sm },
  hint: { paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
});
