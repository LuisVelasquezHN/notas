import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { SheetItem, Text, TextField } from '@/components/ui';
import type { Note } from '@/db/schema';
import * as actions from '@/features/notes/actions';
import { spacing } from '@/theme';

import { MAX_TAG_LENGTH, cleanTagName, createTag, noteTagsQuery, tagsQuery } from '../repository';

/**
 * Asignar etiquetas a una o varias notas. Cada toque cambia la etiqueta al momento.
 * Con varias notas, una etiqueta que solo tienen algunas se marca en todas al tocarla.
 */
export function TagPicker({ notes }: { notes: Note[] }) {
  const { t } = useTranslation();
  const { data: tags } = useLiveQuery(tagsQuery());
  const { data: pairs } = useLiveQuery(noteTagsQuery());
  const [query, setQuery] = useState('');

  const countByTag = useMemo(() => {
    const ids = new Set(notes.map((n) => n.id));
    const map = new Map<string, number>();
    for (const { noteId, tagId } of pairs) {
      if (ids.has(noteId)) map.set(tagId, (map.get(tagId) ?? 0) + 1);
    }
    return map;
  }, [notes, pairs]);

  const name = cleanTagName(query);
  const needle = name.toLocaleLowerCase();
  const shown = needle ? tags.filter((tag) => tag.name.toLocaleLowerCase().includes(needle)) : tags;
  const exact = tags.some((tag) => tag.name.toLocaleLowerCase() === needle);

  async function create() {
    if (!name) return;
    const tag = await createTag({ name, color: 'default' });
    await actions.toggleTag(notes, tag, false);
    setQuery('');
  }

  return (
    <View>
      <View style={styles.field}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={tags.length > 0 ? t('tags.searchOrCreate') : t('folders.newTag')}
          accessibilityLabel={t('tags.searchOrCreate')}
          maxLength={MAX_TAG_LENGTH}
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            const match = shown.length === 1 ? shown[0] : null;
            if (match && exact) {
              void actions.toggleTag(notes, match, countByTag.get(match.id) === notes.length);
              setQuery('');
            } else void create();
          }}
        />
      </View>

      {name && !exact ? (
        <SheetItem
          icon="tagAdd"
          label={t('tags.createNamed', { name })}
          onPress={() => void create()}
        />
      ) : null}

      {shown.map((tag) => {
        const count = countByTag.get(tag.id) ?? 0;
        const all = count === notes.length;
        return (
          <SheetItem
            key={tag.id}
            icon={all ? 'checkboxChecked' : 'checkbox'}
            label={tag.name}
            onPress={() => void actions.toggleTag(notes, tag, all)}
            trailing={
              count > 0 && !all ? (
                <Text variant="caption" tone="muted">
                  {t('tags.someOf', { count, total: notes.length })}
                </Text>
              ) : null
            }
          />
        );
      })}

      {tags.length === 0 && !name ? (
        <Text tone="muted" style={styles.hint}>
          {t('tags.firstHint')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  hint: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
});
