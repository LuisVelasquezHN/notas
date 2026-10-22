import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet, Text, TextField } from '@/components/ui';
import { showSnackbar } from '@/stores/snackbar-store';
import { spacing, useTheme } from '@/theme';

import { MIN_PASSWORD_LENGTH } from '../crypto';
import { changeVaultPassword } from '../repository';

/** Cambiar la contraseña maestra (con la bóveda abierta). */
export function ChangePasswordSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setPassword('');
    setConfirm('');
    setError(null);
    onClose();
  };

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('vault.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('vault.mismatch'));
      return;
    }
    setBusy(true);
    try {
      await changeVaultPassword(password);
      showSnackbar(t('vault.passwordChanged'));
      close();
    } finally {
      setBusy(false);
    }
  };

  const field = (value: string, onChange: (v: string) => void, placeholder: string) => (
    <TextField
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      accessibilityLabel={placeholder}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      textContentType="none"
    />
  );

  return (
    <Sheet visible={visible} onClose={close} title={t('vault.changePassword')}>
      <View style={styles.body}>
        {field(password, setPassword, t('vault.newPassword'))}
        {field(confirm, setConfirm, t('vault.confirmPassword'))}
        <Text variant="caption" tone="secondary">
          {t('vault.passwordHint', { min: MIN_PASSWORD_LENGTH })}
        </Text>
        {error ? (
          <Text variant="caption" style={{ color: colors.danger }}>
            {error}
          </Text>
        ) : null}
        <Button
          title={busy ? t('vault.working') : t('vault.changePassword')}
          disabled={busy}
          onPress={() => void submit()}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
});
