import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { AppLogo, EmptyState, IconButton, Screen, Text } from '@/components/ui';
import { ListControls } from '@/features/notes/components/list-controls';
import { NewNoteButtons } from '@/features/notes/components/new-note-buttons';
import { NoteList } from '@/features/notes/components/note-list';
import { notesQuery } from '@/features/notes/repository';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing } from '@/theme';

export default function NotesScreen() {
  const layout = useSettingsStore((s) => s.notesLayout);
  const sortBy = useSettingsStore((s) => s.notesSortBy);
  const { t } = useTranslation();
  const { data: notes } = useLiveQuery(notesQuery({ scope: 'active', sortBy }), [sortBy]);

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {/* En web el logo ya está en la barra de arriba. */}
          {Platform.OS !== 'web' ? <AppLogo size={34} /> : null}
          <Text variant="largeTitle">{t('notes.title')}</Text>
        </View>
        <View style={styles.headerActions}>
          <IconButton
            icon="search"
            accessibilityLabel={t('common.search')}
            testID="open-search"
            onPress={() => router.push('/search')}
          />
          <ListControls />
        </View>
      </View>

      <NoteList
        notes={notes}
        layout={layout}
        reorderable
        ListEmptyComponent={
          <EmptyState icon="note" title={t('notes.empty')} description={t('notes.emptyHint')} />
        }
      />

      <NewNoteButtons />
    </Screen>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
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
