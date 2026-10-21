import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState, Screen } from '@/components/ui';
import { ListControls } from '@/features/notes/components/list-controls';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

export default function ArchiveScreen() {
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { t } = useTranslation();
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'archived', sortBy }), [sortBy]);

  return (
    <Screen edges={[]} contentStyle={{ paddingHorizontal: 0, paddingTop: spacing.sm }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <ListControls />
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
            icon="archive"
            title={t('notes.archiveEmpty')}
            description={t('notes.archiveEmptyHint')}
          />
        }
      />
    </Screen>
  );
}
