import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  Button,
  Icon,
  SMART_FOLDER_ICONS,
  Sheet,
  Text,
  TextField,
  isIconName,
  type IconName,
} from '@/components/ui';
import type { SavedFilter } from '@/db/schema';
import { showSnackbar } from '@/stores/snackbar-store';
import { radius, spacing, useTheme } from '@/theme';

import { isFilterEmpty, type NoteFilter } from '../filter';
import { createSavedFilter, updateSavedFilter } from '../repository';

export type SmartFolderFormTarget =
  { mode: 'create'; filter: NoteFilter } | { mode: 'edit'; saved: SavedFilter };

type SmartFolderFormSheetProps = {
  target: SmartFolderFormTarget | null;
  onClose: () => void;
  /** Tras crearla. Por defecto se ofrece abrirla desde el snackbar. */
  onCreated?: (saved: SavedFilter) => void;
};

/** Guardar un filtro como carpeta inteligente, o renombrarla y cambiar su icono. */
export function SmartFolderFormSheet({ target, onClose, onCreated }: SmartFolderFormSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={target !== null}
      onClose={onClose}
      title={
        target?.mode === 'edit'
          ? t('smart.edit')
          : target && isFilterEmpty(target.filter)
            ? t('folders.newSmart')
            : t('search.saveAsSmart')
      }>
      {target ? (
        <SmartFolderForm
          key={target.mode === 'edit' ? target.saved.id : 'new'}
          target={target}
          onClose={onClose}
          onCreated={onCreated}
        />
      ) : null}
    </Sheet>
  );
}

function SmartFolderForm({
  target,
  onClose,
  onCreated,
}: {
  target: SmartFolderFormTarget;
  onClose: () => void;
  onCreated?: (saved: SavedFilter) => void;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const initial = target.mode === 'edit' ? target.saved : null;
  // Al guardar una búsqueda, el texto buscado es un buen nombre por defecto.
  const [name, setName] = useState(
    target.mode === 'edit' ? target.saved.name : (target.filter.search ?? ''),
  );
  const [icon, setIcon] = useState<IconName>(
    isIconName(initial?.icon) ? initial.icon : 'smartFolder',
  );
  const valid = name.trim().length > 0;

  async function submit() {
    if (!valid) return;
    if (target.mode === 'edit') {
      await updateSavedFilter(target.saved.id, { name, icon });
      onClose();
      return;
    }
    const saved = await createSavedFilter({ name, icon, filter: target.filter });
    onClose();
    if (onCreated) {
      onCreated(saved);
      return;
    }
    showSnackbar(t('smart.created'), {
      label: t('common.open'),
      onPress: () => router.push({ pathname: '/smart/[id]', params: { id: saved.id } }),
    });
  }

  return (
    <View style={styles.form}>
      <TextField
        value={name}
        onChangeText={setName}
        placeholder={t('smart.namePlaceholder')}
        accessibilityLabel={t('smart.nameLabel')}
        autoFocus
        maxLength={60}
        returnKeyType="done"
        onSubmitEditing={() => void submit()}
      />
      {target.mode === 'create' ? (
        <Text variant="caption" tone="secondary">
          {isFilterEmpty(target.filter) ? t('smart.emptyFormHint') : t('smart.formHint')}
        </Text>
      ) : null}

      <Text variant="label" tone="secondary">
        {t('icons.title').toUpperCase()}
      </Text>
      <View style={styles.wrap}>
        {SMART_FOLDER_ICONS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={t(`icons.${option}`)}
            aria-selected={option === icon}
            onPress={() => setIcon(option)}
            style={[
              styles.icon,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: option === icon ? colors.primary : colors.border,
                borderWidth: option === icon ? 2 : StyleSheet.hairlineWidth,
              },
            ]}>
            <Icon name={option} size={20} />
          </Pressable>
        ))}
      </View>

      <Button
        title={target.mode === 'edit' ? t('common.save') : t('smart.create')}
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
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submit: { marginTop: spacing.sm },
});
