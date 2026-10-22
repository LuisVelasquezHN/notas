import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Stack, router } from 'expo-router';
import { usePreventCapture } from '@/lib/use-prevent-capture';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

import {
  EmptyState,
  Fab,
  Icon,
  IconButton,
  Screen,
  Sheet,
  SheetItem,
  Text,
  afterSheetClose,
} from '@/components/ui';
import { exportSecureNotes } from '@/features/vault/actions';
import {
  biometricUnlockAvailable,
  disableBiometricUnlock,
  enableBiometricUnlock,
  isBiometricUnlockEnabled,
} from '@/features/vault/biometrics';
import { ChangePasswordSheet } from '@/features/vault/components/change-password-sheet';
import { TypedConfirmSheet } from '@/features/vault/components/typed-confirm-sheet';
import { CreateVault, UnlockVault } from '@/features/vault/components/vault-gate';
import { useSecureNotes } from '@/features/vault/hooks';
import { resetVault, vaultsQuery } from '@/features/vault/repository';
import { useVaultStore } from '@/features/vault/store';
import { formatRelativeDate } from '@/lib/dates';
import { useNow } from '@/lib/use-now';
import { showSnackbar } from '@/stores/snackbar-store';
import { radius, spacing, useTheme } from '@/theme';

/** Notas seguras: crear la bóveda, desbloquearla o ver sus notas (PLAN.md §10). */
export default function VaultScreen() {
  // En Android impide capturas y grabaciones de pantalla mientras se ve la bóveda.
  usePreventCapture();
  const { data: vaults } = useLiveQuery(vaultsQuery());
  const unlocked = useVaultStore((s) => s.keys !== null);

  return (
    <Screen scroll={!unlocked} edges={[]}>
      {vaults.length === 0 ? (
        <CreateVault />
      ) : !unlocked ? (
        <UnlockVault vaults={vaults} />
      ) : (
        <VaultContents />
      )}
    </Screen>
  );
}

type Dialog = 'menu' | 'password' | 'export' | 'reset' | null;

function VaultContents() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const now = useNow();
  const { notes } = useSecureNotes();
  const primaryId = useVaultStore((s) => s.primaryId);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [biometric, setBiometric] = useState(
    () => !!primaryId && isBiometricUnlockEnabled(primaryId),
  );

  const toggleBiometric = async (enabled: boolean) => {
    const { keys } = useVaultStore.getState();
    if (!primaryId || !keys?.[primaryId]) return;
    try {
      if (enabled)
        await enableBiometricUnlock(primaryId, keys[primaryId], t('vault.biometricPrompt'));
      else await disableBiometricUnlock(primaryId);
      setBiometric(enabled);
    } catch (e) {
      console.warn('Bóveda: biometría', e);
      showSnackbar(t('vault.biometricFailed'));
    }
  };

  const open = (next: Dialog) => {
    setDialog(null);
    afterSheetClose(() => setDialog(next));
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.header}>
              <IconButton
                icon="lock"
                accessibilityLabel={t('vault.lock')}
                onPress={() => useVaultStore.getState().lock()}
              />
              <IconButton
                icon="more"
                accessibilityLabel={t('vault.options')}
                onPress={() => setDialog('menu')}
              />
            </View>
          ),
        }}
      />
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text variant="caption" tone="muted" style={styles.hint}>
            {t('vault.autoLock')}
          </Text>
        }
        ListEmptyComponent={
          <EmptyState icon="key" title={t('vault.empty')} description={t('vault.emptyHint')} />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/vault/[id]', params: { id: item.id } })}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? colors.surfacePressed : colors.surface },
            ]}>
            <Icon name="key" size={20} color={colors.textSecondary} />
            <View style={styles.flex}>
              <Text numberOfLines={1}>
                {item.content
                  ? item.content.title.trim() || t('vault.untitled')
                  : t('vault.unreadable')}
              </Text>
              <Text variant="caption" tone="secondary">
                {formatRelativeDate(item.updatedAt, now, t)}
              </Text>
            </View>
            <Icon name="chevronRight" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      />
      <Fab
        accessibilityLabel={t('vault.newNote')}
        onPress={() => router.push({ pathname: '/vault/[id]', params: { id: 'new' } })}
        testID="vault-new-note"
      />

      <Sheet visible={dialog === 'menu'} onClose={() => setDialog(null)} title={t('vault.options')}>
        {biometricUnlockAvailable ? (
          <View style={styles.switchRow}>
            <Icon name="fingerprint" size={20} color={colors.textSecondary} />
            <View style={styles.flex}>
              <Text>{t('vault.biometric')}</Text>
              <Text variant="caption" tone="secondary">
                {biometric ? t('vault.biometricOn') : t('vault.biometricOff')}
              </Text>
            </View>
            <Switch
              value={biometric}
              onValueChange={(v) => void toggleBiometric(v)}
              accessibilityLabel={t('vault.biometric')}
              trackColor={{ true: colors.primary }}
            />
          </View>
        ) : null}
        <SheetItem icon="key" label={t('vault.changePassword')} onPress={() => open('password')} />
        <SheetItem icon="share" label={t('vault.export')} onPress={() => open('export')} />
        <SheetItem
          icon="trash"
          label={t('vault.reset')}
          destructive
          onPress={() => open('reset')}
        />
      </Sheet>

      <ChangePasswordSheet visible={dialog === 'password'} onClose={() => setDialog(null)} />
      <TypedConfirmSheet
        visible={dialog === 'export'}
        title={t('vault.exportTitle')}
        message={t('vault.exportMessage', { word: t('vault.exportWord') })}
        word={t('vault.exportWord')}
        confirmLabel={t('vault.exportAction')}
        onClose={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          afterSheetClose(() => void exportSecureNotes());
        }}
      />
      <TypedConfirmSheet
        visible={dialog === 'reset'}
        title={t('vault.resetTitle')}
        message={t('vault.resetMessage', { word: t('vault.resetWord') })}
        word={t('vault.resetWord')}
        confirmLabel={t('vault.resetAction')}
        destructive
        onClose={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          void resetVault().then(() => showSnackbar(t('vault.resetDone')));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row' },
  list: { gap: spacing.sm, paddingVertical: spacing.md, paddingBottom: 120 },
  hint: { paddingBottom: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    minHeight: 56,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
});
