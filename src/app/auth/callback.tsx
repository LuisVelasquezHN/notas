import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { exchangeCode } from '@/features/sync/auth';
import { showSnackbar } from '@/stores/snackbar-store';
import { spacing, useTheme } from '@/theme';

/**
 * Vuelta del inicio de sesión con Google (`/auth/callback?code=…`). En web canjea el código; en
 * Android el enlace llega también aquí (el canje lo hace `signInWithGoogle`, una sola vez).
 * Después vuelve a Ajustes.
 */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let ok = !error;
      if (code) ok = await exchangeCode(code).catch(() => false);
      if (cancelled) return;
      if (!ok && error !== 'access_denied') showSnackbar(t('account.signInFailed'));
      router.replace('/settings');
    })();
    return () => {
      cancelled = true;
    };
  }, [code, error, t]);

  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
      <Text tone="secondary">{t('account.completing')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
});
