import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { openDatabase, type Database } from '@/db';
import { ensureSearchIndex } from '@/db/search-index';
import { purgeAttachments } from '@/features/attachments/repository';
import { purgeExpiredTrash } from '@/features/notes/repository';
import { syncLanguageWithSettings } from '@/i18n/sync';
import { capabilities } from '@/lib/capabilities';
import { warmUpKvStorage } from '@/lib/kv-storage';
import { useSecurityStore } from '@/stores/security-store';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';

/**
 * Prepara todo lo necesario antes de renderizar la app:
 * 1. abre el almacén de preferencias, hidrata los ajustes y aplica el idioma elegido,
 * 2. abre la base de datos,
 * 3. aplica las migraciones pendientes,
 * 4. prepara el índice de búsqueda (solo nativo), purga la papelera caducada y los ficheros de
 *    adjuntos que ya no se usan.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
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

  if (error) return <BootError error={error} />;
  if (!db) return <BootLoading />;
  return <Migrations db={db}>{children}</Migrations>;
}

function Migrations({ db, children }: { db: Database; children: ReactNode }) {
  const { success, error } = useMigrations(db, migrations);
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<Error | null>(null);

  useEffect(() => {
    if (!success) return;
    (async () => {
      await ensureSearchIndex(db);
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

function BootError({ error }: { error: Error }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text variant="heading">{t('boot.dbError')}</Text>
      <Text tone="secondary" selectable>
        {error.message}
      </Text>
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
