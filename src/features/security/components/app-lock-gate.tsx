import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View, type AppStateStatus } from 'react-native';

import { Button, Icon, Text } from '@/components/ui';
import { capabilities } from '@/lib/capabilities';
import { useSecurityStore } from '@/stores/security-store';
import { LOCK_AFTER_MS, useSettingsStore } from '@/stores/settings-store';
import { radius, spacing, useTheme } from '@/theme';

import { authenticate, getAuthSupport, isAuthenticating, type BiometryKind } from '../auth';

/**
 * Bloqueo de la app (iOS y Android). Se monta una vez, encima del navegador:
 * - al arrancar con el bloqueo activado (lo marca `AppBootstrap`), y al volver tras `lockAfter` en segundo plano, cubre la
 *   app y pide biometría o el código del dispositivo;
 * - al pasar a segundo plano tapa el contenido (vista previa del selector de apps) y vuelve a
 *   bloquear las notas bloqueadas que se habían abierto.
 * El navegador sigue montado debajo: al desbloquear se vuelve a la misma pantalla.
 */
export function AppLockGate() {
  return capabilities.biometrics ? <NativeGate /> : null;
}

function NativeGate() {
  const appLock = useSettingsStore((s) => s.appLock);
  const locked = useSecurityStore((s) => s.appLocked);
  const [covered, setCovered] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      const { appLock: enabled, lockAfter } = useSettingsStore.getState();
      const security = useSecurityStore.getState();
      if (state === 'active') {
        setCovered(false);
        const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
        if (hiddenAt.current !== null && away >= LOCK_AFTER_MS[lockAfter]) {
          security.relockNotes();
          if (enabled) security.lockApp();
        }
        hiddenAt.current = null;
        return;
      }
      // El diálogo de Face ID pone la app en "inactive": no es salir de la app.
      if (isAuthenticating()) return;
      if (enabled) setCovered(true);
      if (state === 'background' && hiddenAt.current === null) hiddenAt.current = Date.now();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  if (locked && appLock) return <LockScreen />;
  if (covered) return <PrivacyCover />;
  return null;
}

function LockScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [biometry, setBiometry] = useState<BiometryKind>(null);
  const unlockApp = useSecurityStore((s) => s.unlockApp);

  const unlock = async () => {
    if (await authenticate(t('lock.unlockAppReason'))) unlockApp();
  };

  useEffect(() => {
    void getAuthSupport().then((support) => setBiometry(support.biometry));
    // Se pide al aparecer (y al volver a la app, que vuelve a montar la pantalla).
    if (AppState.currentState === 'active') void unlock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }]}
      accessibilityViewIsModal>
      <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
        <Icon name="lock" size={36} color={colors.text} />
      </View>
      <Text variant="title" accessibilityRole="header" style={styles.center}>
        {t('lock.appLockedTitle')}
      </Text>
      <Text tone="secondary" style={styles.center}>
        {t('lock.appLockedHint')}
      </Text>
      <Button
        title={t(`lock.unlockWith.${biometry ?? 'passcode'}`)}
        icon={biometry === 'face' ? 'faceId' : biometry ? 'fingerprint' : 'lockOpen'}
        onPress={() => void unlock()}
        style={styles.button}
      />
    </View>
  );
}

function PrivacyCover() {
  const { colors } = useTheme();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: colors.background }]}
      importantForAccessibility="no-hide-descendants">
      <Icon name="lock" size={36} color={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  badge: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  center: { textAlign: 'center' },
  button: { marginTop: spacing.md, alignSelf: 'stretch', maxWidth: 360, width: '100%' },
});
