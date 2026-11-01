import { useDeferredValue, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, Sheet, Text, TextField } from '@/components/ui';
import type { Note } from '@/db/schema';
import { useFilteredNotes } from '@/features/filters/hooks/use-filtered-notes';
import { foldText } from '@/features/search/highlight';
import { searchTerms } from '@/features/search/query';
import { spacing, useTheme } from '@/theme';

/** Notas que se muestran (las más recientes, o las que coinciden con la búsqueda). */
const MAX_RESULTS = 20;

type NoteLinkSheetProps = {
  visible: boolean;
  /** Nota que se está editando (no se ofrece enlazarla consigo misma). */
  currentNoteId: string;
  onClose: () => void;
  onPick: (note: Note) => void;
  onDismiss?: () => void;
};

/** Buscador de notas para enlazar una desde el texto (al escribir `[[` o desde "Añadir"). */
export function NoteLinkSheet({
  visible,
  currentNoteId,
  onClose,
  onPick,
  onDismiss,
}: NoteLinkSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim());
  const { data } = useFilteredNotes(
    { search: search || undefined, includeArchived: true },
    { sortBy: 'updatedAt' },
  );
  const notes = useMemo(() => {
    const others = data.filter((n) => n.id !== currentNoteId);
    if (!search) return others.slice(0, MAX_RESULTS);
    // Primero las que lo tienen en el título (lo normal al buscar la nota que enlazar).
    const terms = searchTerms(search).map(foldText);
    const inTitle = (n: Note) => terms.every((term) => foldText(n.title).includes(term));
    return [...others.filter(inTitle), ...others.filter((n) => !inTitle(n))].slice(0, MAX_RESULTS);
  }, [data, currentNoteId, search]);

  const close = () => {
    setQuery('');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} onDismiss={onDismiss} title={t('noteLinks.title')}>
      <View style={styles.search}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={t('noteLinks.placeholder')}
          accessibilityLabel={t('noteLinks.placeholder')}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            // Solo con los resultados de lo escrito (la búsqueda se aplica con un instante de retraso).
            if (notes[0] && search === query.trim()) {
              setQuery('');
              onPick(notes[0]);
            }
          }}
          testID="note-link-search"
        />
      </View>
      {notes.length === 0 ? (
        <Text tone="muted" style={styles.empty}>
          {search ? t('noteLinks.noResults') : t('noteLinks.empty')}
        </Text>
      ) : (
        notes.map((note) => (
          <Pressable
            key={note.id}
            accessibilityRole="button"
            onPress={() => {
              setQuery('');
              onPick(note);
            }}
            style={({ pressed }) => [
              styles.row,
              pressed && { backgroundColor: colors.surfaceMuted },
            ]}>
            <Icon
              name={note.type === 'checklist' ? 'checklist' : 'note'}
              size={20}
              color={colors.textSecondary}
            />
            <View style={styles.body}>
              <Text numberOfLines={1}>{note.title.trim() || t('card.untitled')}</Text>
              {/* De una nota bloqueada, solo el título. */}
              {!note.isLocked && note.contentText.trim() ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {note.contentText.trim().replace(/\n+/g, ' · ')}
                </Text>
              ) : null}
            </View>
          </Pressable>
        ))
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, fontStyle: 'italic' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  body: { flex: 1, gap: 2 },
});
