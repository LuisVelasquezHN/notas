import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'trash' }));

  return (
    <Screen edges={[]} contentStyle={styles.screen}>
      <Stack.Screen
        options={{
          headerRight: () =>
            notes.length > 0 ? (
              <Button
                title={t('trash.empty')}
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
          return days <= 1 ? t('trash.deletesToday') : t('trash.deletesIn', { count: days });
        }}
        ListHeaderComponent={
          notes.length > 0 ? (
            <View style={styles.hint}>
              <Text variant="caption" tone="secondary">
                {t('trash.hint', { count: TRASH_RETENTION_DAYS })}
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="trash"
            title={t('trash.emptyState')}
            description={t('trash.emptyStateHint', { count: TRASH_RETENTION_DAYS })}
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
