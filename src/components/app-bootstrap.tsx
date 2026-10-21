import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { openDatabase, type Database } from '@/db';
import { ensureSearchIndex } from '@/db/search-index';
import { acquireDatabaseLock } from '@/db/tab-lock';
import { purgeAttachments } from '@/features/attachments/repository';
import { purgeExpiredTrash } from '@/features/notes/repository';
import { ensureSyncTracking } from '@/features/sync/tracking';
import { syncLanguageWithSettings } from '@/i18n/sync';
import { capabilities } from '@/lib/capabilities';
import { reportError } from '@/lib/monitoring';
import { warmUpKvStorage } from '@/lib/kv-storage';
import { useSecurityStore } from '@/stores/security-store';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';

/**
 * Prepara todo lo necesario antes de renderizar la app:
 * 0. en web, espera a que ninguna otra pestaña tenga abierta la base de datos,
 * 1. abre el almacén de preferencias, hidrata los ajustes y aplica el idioma elegido,
 * 2. abre la base de datos,
 * 3. aplica las migraciones pendientes,
 * 4. prepara el índice de búsqueda (solo nativo) y el seguimiento de cambios para sincronizar,
 *    purga la papelera caducada y los ficheros de adjuntos que ya no se usan.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const hydrated = useHydrated();

  useEffect(() => {
    (async () => {
      await acquireDatabaseLock(() => setOtherTab(true));
      setOtherTab(false);
      await warmUpKvStorage();
      await useSettingsStore.persist.rehydrate();
      syncLanguageWithSettings();
      // Con el bloqueo activado, la app arranca bloqueada (ver `AppLockGate`).
      if (capabilities.biometrics && useSettingsStore.getState().appLock) {
        useSecurityStore.getState().lockApp();
      }
      setDb(await openDatabase());
    })().catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (!hydrated) return null;
  if (error) return <BootError error={error} />;
  if (otherTab) return <BootOtherTab />;
  if (!db) return <BootLoading />;
  return <Migrations db={db}>{children}</Migrations>;
}

const noSubscribe = () => () => {};

/**
 * En web la primera pasada se renderiza en el servidor, que no conoce el tema del usuario: hasta
 * hidratar en el cliente no se pinta nada, para que el HTML coincida. En nativo es `true` siempre.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

function Migrations({ db, children }: { db: Database; children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    (async () => {
      await ensureSearchIndex(db);
      await ensureSyncTracking(db);
      await purgeExpiredTrash();
      // Limpieza de ficheros: si falla, la app arranca igual.
      await purgeAttachments().catch((e: unknown) => console.warn('Adjuntos: error al purgar', e));
      setReady(true);
    })().catch((e: unknown) => setStartupError(e instanceof Error ? e : new Error(String(e))));
  }, [db, success]);

  const failure = error ?? startupError;
  useEffect(() => {
    if (ready || failure) SplashScreen.hideAsync();
  }, [ready, failure]);

  if (failure) return <BootError error={failure} />;
  if (!ready) return <BootLoading />;
  return children;
}

function BootLoading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

function BootOtherTab() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text variant="heading">{t('boot.otherTab')}</Text>
      <Text tone="secondary">{t('boot.otherTabHint')}</Text>
    </View>
  );
}

function BootError({ error }: { error: Error }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  useEffect(() => reportError(error), [error]);
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text variant="heading">{t('boot.dbError')}</Text>
      <Text tone="secondary" selectable>
        {error.message}
      </Text>
      {/* Drizzle envuelve el error de SQLite: la causa es lo que explica el fallo. */}
      {error.cause instanceof Error ? (
        <Text tone="secondary" selectable>
          {error.cause.message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
  },
});
