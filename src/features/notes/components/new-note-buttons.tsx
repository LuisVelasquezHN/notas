import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Icon } from '@/components/ui';
import type { NoteType } from '@/db/schema';
import { radius, spacing, useTheme } from '@/theme';

import { createNote } from '../repository';

/** Botones flotantes para crear una nota de texto (principal) o una checklist. */
export function NewNoteButtons({ folderId = null }: { folderId?: string | null }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  async function create(type: NoteType) {
    const note = await createNote(type, { folderId });
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Nueva lista"
        onPress={() => void create('checklist')}
        style={({ pressed }) => [
          styles.secondary,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            bottom: insets.bottom + spacing.lg + 56 + spacing.md,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}>
        <Icon name="checklist" size={22} color={colors.text} />
      </Pressable>
      <Fab accessibilityLabel="Nueva nota" onPress={() => void create('text')} />
    </>
  );
}

const styles = StyleSheet.create({
  secondary: {
    position: 'absolute',
    right: spacing.lg + 6,
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
