import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Fab, Icon, afterSheetClose, type IconName } from '@/components/ui';
import type { Note, NoteType } from '@/db/schema';
import { createNoteFromTemplate } from '@/features/templates/repository';
import { TemplateSheet } from '@/features/templates/components/template-sheet';
import type { NoteTemplate } from '@/features/templates/templates';
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

/** Botones flotantes: nota de texto (principal), checklist o desde plantilla. */
export function NewNoteButtons({ folderId = null, tagId, favorite = false }: NewNoteButtonsProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // En selección múltiple la barra de acciones ocupa su sitio.
  const selecting = useIsSelecting();
  const [templatesOpen, setTemplatesOpen] = useState(false);

  async function open(note: Note) {
    if (tagId) await setTagOnNotes(tagId, [note.id], true);
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  const create = async (type: NoteType) =>
    open(await createNote(type, { folderId, isFavorite: favorite }));

  const createFromTemplate = (template: NoteTemplate) => {
    setTemplatesOpen(false);
    afterSheetClose(
      () => void createNoteFromTemplate(template, { folderId, isFavorite: favorite }).then(open),
    );
  };

  if (selecting) return null;

  const secondary: { icon: IconName; label: string; onPress: () => void }[] = [
    { icon: 'checklist', label: t('newNote.checklist'), onPress: () => void create('checklist') },
    { icon: 'template', label: t('newNote.template'), onPress: () => setTemplatesOpen(true) },
  ];

  return (
    <>
      {secondary.map((button, i) => (
        <Pressable
          key={button.icon}
          accessibilityRole="button"
          accessibilityLabel={button.label}
          onPress={button.onPress}
          style={({ pressed }) => [
            styles.secondary,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              bottom: insets.bottom + spacing.lg + 56 + spacing.md + i * (44 + spacing.sm),
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}>
          <Icon name={button.icon} size={22} color={colors.text} />
        </Pressable>
      ))}
      <Fab accessibilityLabel={t('newNote.text')} onPress={() => void create('text')} />
      <TemplateSheet
        visible={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        onPick={createFromTemplate}
      />
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
