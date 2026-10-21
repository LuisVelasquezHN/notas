import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { EmptyState, Screen } from '@/components/ui';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import { ListControls } from '@/features/notes/components/list-controls';
import { NewNoteButtons } from '@/features/notes/components/new-note-buttons';
import { NoteList } from '@/features/notes/components/note-list';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

const FAVORITES = { favorite: true } as const;

export default function FavoritesScreen() {
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { t } = useTranslation();
  const { data: notes } = useFilteredNotes(FAVORITES, { sortBy });

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
            icon="star"
            title={t('notes.favoritesEmpty')}
            description={t('notes.favoritesEmptyHint')}
          />
        }
      />
      <NewNoteButtons favorite />
    </Screen>
  );
}
