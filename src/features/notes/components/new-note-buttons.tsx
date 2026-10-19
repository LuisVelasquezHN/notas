import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Icon } from '@/components/ui';
import type { NoteType } from '@/db/schema';
import { setTagOnNotes } from '@/features/tags/repository';
import { useIsSelecting } from '@/stores/ui-store';
import { radius, spacing, useTheme } from '@/theme';

import { createNote } from '../repository';

type NewNoteButtonsProps = {
  /** La nota nueva se crea en esta carpeta… */
  folderId?: string | null;
  /** …con esta etiqueta… */
  tagId?: string;
  /** …o ya marcada como favorita (según la pantalla desde la que se crea). */
  favorite?: boolean;
};

/** Botones flotantes para crear una nota de texto (principal) o una checklist. */
export function NewNoteButtons({ folderId = null, tagId, favorite = false }: NewNoteButtonsProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // En selección múltiple la barra de acciones ocupa su sitio.
  const selecting = useIsSelecting();

  async function create(type: NoteType) {
    const note = await createNote(type, { folderId, isFavorite: favorite });
    if (tagId) await setTagOnNotes(tagId, [note.id], true);
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  if (selecting) return null;

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
