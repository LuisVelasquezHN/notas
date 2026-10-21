import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, ColorSwatch, Sheet, Text, TextField } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { NOTE_COLOR_TOKENS, spacing, type NoteColor } from '@/theme';

import {
  DuplicateTagError,
  MAX_TAG_LENGTH,
  cleanTagName,
  createTag,
  updateTag,
} from '../repository';

export type TagFormTarget = { mode: 'create' } | { mode: 'edit'; tag: Tag };

type TagFormSheetProps = {
  target: TagFormTarget | null;
  onClose: () => void;
};

/** Crear o editar una etiqueta: nombre y color. */
export function TagFormSheet({ target, onClose }: TagFormSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={target !== null}
      onClose={onClose}
      title={target?.mode === 'edit' ? t('tags.edit') : t('folders.newTag')}>
      {target ? (
        <TagForm
          key={target.mode === 'edit' ? target.tag.id : 'new'}
          target={target}
          onDone={onClose}
        />
      ) : null}
    </Sheet>
  );
}

function TagForm({ target, onDone }: { target: TagFormTarget; onDone: () => void }) {
  const { t } = useTranslation();
  const initial = target.mode === 'edit' ? target.tag : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState<NoteColor>(initial?.color ?? 'default');
  const [error, setError] = useState<string | null>(null);
  const valid = cleanTagName(name).length > 0;

  async function submit() {
    if (!valid) return;
    try {
      if (target.mode === 'edit') await updateTag(target.tag.id, { name, color });
      else await createTag({ name, color });
      onDone();
    } catch (e) {
      if (e instanceof DuplicateTagError) setError(t('tags.duplicate', { name: e.tagName }));
      else throw e;
    }
  }

  return (
    <View style={styles.form}>
      <TextField
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        placeholder={t('tags.nameLabel')}
        accessibilityLabel={t('tags.nameLabel')}
        autoFocus
        autoCorrect={false}
        maxLength={MAX_TAG_LENGTH}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Text variant="label" tone="secondary">
        {t('filters.color').toUpperCase()}
      </Text>
      <View style={styles.wrap}>
        {NOTE_COLOR_TOKENS.map((token) => (
          <ColorSwatch
            key={token}
            color={token}
            selected={token === color}
            onPress={() => setColor(token)}
          />
        ))}
      </View>

      <Button
        title={target.mode === 'edit' ? t('common.save') : t('tags.create')}
        disabled={!valid}
        onPress={() => void submit()}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  submit: { marginTop: spacing.sm },
});
