import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button, Icon, Text, TextField } from '@/components/ui';
import type { Vault } from '@/db/schema';
import { showSnackbar } from '@/stores/snackbar-store';
import { radius, spacing, useTheme } from '@/theme';

import {
  biometricUnlockAvailable,
  isBiometricUnlockEnabled,
  unlockWithBiometrics,
} from '../biometrics';
import { MIN_PASSWORD_LENGTH } from '../crypto';
import { createVault, resetVault, unlockVault, unlockWithKey } from '../repository';
import { TypedConfirmSheet } from './typed-confirm-sheet';

/** Campo de contraseña (sin autocorrección ni sugerencias del teclado). */
function PasswordField(props: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
  autoFocus?: boolean;
  testID?: string;
}) {
  return (
    <TextField
      {...props}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="off"
      textContentType="none"
      accessibilityLabel={props.placeholder}
      returnKeyType="done"
    />
  );
}

/** Primera vez: crear la contraseña maestra. */
export function CreateVault() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('vault.tooShort', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirm) {
      setError(t('vault.mismatch'));
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await createVault(password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Badge />
      <Text variant="title" accessibilityRole="header">
        {t('vault.createTitle')}
      </Text>
      <Text tone="secondary">{t('vault.intro')}</Text>
      <PasswordField
        value={password}
        onChangeText={setPassword}
        placeholder={t('vault.password')}
        autoFocus
        testID="vault-password"
      />
      <PasswordField
        value={confirm}
        onChangeText={setConfirm}
        placeholder={t('vault.confirmPassword')}
        onSubmitEditing={() => void submit()}
        testID="vault-password-confirm"
      />
      <Text variant="caption" tone="secondary">
        {t('vault.passwordHint', { min: MIN_PASSWORD_LENGTH })}
      </Text>
      <View style={[styles.warning, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="info" size={18} color={colors.danger} />
        <Text variant="caption" style={styles.flex}>
          {t('vault.noRecovery')}
        </Text>
      </View>
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button
        title={busy ? t('vault.working') : t('vault.create')}
        disabled={busy}
        onPress={() => void submit()}
        testID="vault-create"
      />
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
    </View>
  );
}

/** Bóveda bloqueada: contraseña o biometría; y borrar todo si se olvidó la contraseña. */
export function UnlockVault({ vaults }: { vaults: Vault[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const primary = vaults[0];
  const biometric = biometricUnlockAvailable && !!primary && isBiometricUnlockEnabled(primary.id);

  const tryBiometrics = async () => {
    if (!primary) return;
    const key = await unlockWithBiometrics(primary.id, t('vault.biometricPrompt'));
    if (key) unlockWithKey(primary.id, key);
  };

  useEffect(() => {
    // Con la biometría activada se ofrece directamente al abrir.
    if (biometric) void tryBiometrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!password) return;
    setBusy(true);
    setError(null);
    try {
      const ok = await unlockVault(password);
      if (!ok) setError(t('vault.wrongPassword'));
      else setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <Badge />
      <Text variant="title" accessibilityRole="header">
        {t('vault.lockedTitle')}
      </Text>
      <Text tone="secondary">{t('vault.lockedHint')}</Text>
      <PasswordField
        value={password}
        onChangeText={setPassword}
        placeholder={t('vault.password')}
        onSubmitEditing={() => void submit()}
        autoFocus={!biometric}
        testID="vault-unlock-password"
      />
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <Button
        title={busy ? t('vault.working') : t('vault.unlock')}
        disabled={busy || !password}
        onPress={() => void submit()}
        testID="vault-unlock"
      />
      {busy ? <ActivityIndicator color={colors.primary} /> : null}
      {biometric ? (
        <Button
          title={t('vault.unlockBiometric')}
          icon="fingerprint"
          variant="secondary"
          onPress={() => void tryBiometrics()}
        />
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => setResetting(true)} style={styles.link}>
        <Text variant="caption" tone="secondary">
          {t('vault.forgot')}
        </Text>
      </Pressable>
      <TypedConfirmSheet
        visible={resetting}
        title={t('vault.resetTitle')}
        message={t('vault.resetMessage', { word: t('vault.resetWord') })}
        word={t('vault.resetWord')}
        confirmLabel={t('vault.resetAction')}
        destructive
        onClose={() => setResetting(false)}
        onConfirm={() => {
          setResetting(false);
          void resetVault().then(() => showSnackbar(t('vault.resetDone')));
        }}
      />
    </View>
  );
}

function Badge() {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name="vault" size={32} color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.md,
    paddingVertical: spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'flex-start',
  },
  flex: { flex: 1 },
  link: { alignSelf: 'center', padding: spacing.sm },
});
