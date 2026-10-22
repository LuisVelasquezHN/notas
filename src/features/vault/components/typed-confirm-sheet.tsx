import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, TextField } from '@/components/ui';
import { spacing } from '@/theme';

type TypedConfirmSheetProps = {
  visible: boolean;
  title: string;
  message: string;
  /** Palabra que hay que escribir (sin distinguir mayúsculas) para habilitar la acción. */
  word: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/**
 * Confirmación para acciones peligrosas (exportar sin cifrar, borrar la bóveda): hay que escribir
 * una palabra, como en las consolas de AWS o GitHub, para que no se hagan por un toque sin querer.
 */
export function TypedConfirmSheet({
  visible,
  title,
  message,
  word,
  confirmLabel,
  destructive = false,
  onConfirm,
  onClose,
}: TypedConfirmSheetProps) {
  const { t } = useTranslation();
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLocaleUpperCase() === word.toLocaleUpperCase();
  const close = () => {
    setTyped('');
    onClose();
  };
  return (
    <Sheet visible={visible} onClose={close} title={title}>
      <View style={styles.body}>
        <Text tone="secondary">{message}</Text>
        <TextField
          value={typed}
          onChangeText={setTyped}
          placeholder={t('vault.typeToConfirm', { word })}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          accessibilityLabel={t('vault.typeToConfirm', { word })}
          testID="typed-confirm-input"
        />
        <View style={styles.buttons}>
          <Button title={t('common.cancel')} variant="secondary" onPress={close} />
          <Button
            title={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            disabled={!matches}
            onPress={() => {
              setTyped('');
              onConfirm();
            }}
            testID="typed-confirm-button"
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
