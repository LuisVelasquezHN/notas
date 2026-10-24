import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { formatRelativeDate } from '@/lib/dates';
import { confirm } from '@/lib/confirm';
import { useNow } from '@/lib/use-now';
import { showSnackbar } from '@/stores/snackbar-store';
import { spacing, useTheme } from '@/theme';

import { deleteAccount, signInWithGoogle, signOut } from '../auth';
import { syncNow } from '../engine';
import { useSyncStore } from '../store';

/** Ajustes → Cuenta y sincronización: entrar con Google, estado, sincronizar y salir. */
export function AccountSection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const account = useSyncStore((s) => s.account);
  const status = useSyncStore((s) => s.status);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const realtime = useSyncStore((s) => s.realtime);
  const now = useNow();
  const [busy, setBusy] = useState(false);

  if (account === undefined) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  if (!account) {
    const onSignIn = async () => {
      setBusy(true);
      try {
        const result = await signInWithGoogle();
        if (result === 'error') showSnackbar(t('account.signInFailed'));
      } catch (e) {
        console.warn('Cuenta: error al iniciar sesión', e);
        showSnackbar(t('account.signInFailed'));
      } finally {
        setBusy(false);
      }
    };
    return (
      <View style={styles.block}>
        <View style={styles.row}>
          <Icon name="cloud" size={20} color={colors.textSecondary} />
          <View style={styles.label}>
            <Text>{t('account.signedOutTitle')}</Text>
            <Text variant="caption" tone="secondary">
              {t('account.signedOutHint')}
            </Text>
          </View>
        </View>
        <Button
          title={busy ? t('account.completing') : t('account.signIn')}
          disabled={busy}
          onPress={() => void onSignIn()}
          testID="account-sign-in"
        />
      </View>
    );
  }

  const statusText =
    status === 'syncing'
      ? t('account.status.syncing')
      : status === 'error'
        ? t('account.status.error')
        : lastSyncedAt
          ? t('account.status.idle', { when: formatRelativeDate(lastSyncedAt, now, t) })
          : t('account.status.never');

  const onSignOut = async () => {
    const ok = await confirm({
      title: t('account.signOutTitle'),
      message: t('account.signOutMessage'),
      confirmLabel: t('account.signOut'),
      destructive: true,
    });
    if (!ok) return;
    const result = await signOut().catch((e: unknown) => {
      console.warn('Cuenta: error al cerrar sesión', e);
      return 'pending' as const;
    });
    showSnackbar(result === 'ok' ? t('account.signedOut') : t('account.signOutPending'));
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: t('account.deleteTitle'),
      message: t('account.deleteMessage'),
      confirmLabel: t('account.deleteConfirm'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await deleteAccount();
      showSnackbar(t('account.deleted'));
    } catch (e) {
      console.warn('Cuenta: error al eliminarla', e);
      showSnackbar(t('account.deleteFailed'));
    }
  };

  return (
    <View style={styles.block}>
      <View style={styles.row}>
        <Icon name="account" size={20} color={colors.textSecondary} />
        <View style={styles.label}>
          <Text>{account.name ?? account.email}</Text>
          {account.name && account.email ? (
            <Text variant="caption" tone="secondary">
              {account.email}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.row} accessibilityLiveRegion="polite">
        <Icon
          name={status === 'error' ? 'cloudOff' : 'cloudSync'}
          size={20}
          color={status === 'error' ? colors.danger : colors.textSecondary}
        />
        <Text variant="caption" tone="secondary" style={styles.label}>
          {statusText}
        </Text>
        {status === 'syncing' ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      <View style={styles.row}>
        <View
          style={[styles.dot, { backgroundColor: realtime ? colors.success : colors.textMuted }]}
        />
        <Text variant="caption" tone="secondary" style={styles.label}>
          {realtime ? t('account.realtimeOn') : t('account.realtimeOff')}
        </Text>
      </View>
      <View style={styles.buttons}>
        <Button
          title={t('account.syncNow')}
          variant="secondary"
          disabled={status === 'syncing'}
          onPress={() => void syncNow()}
        />
        <Button title={t('account.signOut')} variant="ghost" onPress={() => void onSignOut()} />
      </View>
      <Button
        title={t('account.deleteAccount')}
        variant="ghost"
        onPress={() => void onDelete()}
        style={styles.delete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { padding: spacing.md },
  block: { gap: spacing.sm, padding: spacing.xs, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm },
  label: { flex: 1, gap: spacing.xxs },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 6 },
  delete: { alignSelf: 'flex-start' },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
});
