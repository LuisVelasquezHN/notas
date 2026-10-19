import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { openDatabase, type Database } from '@/db';
import { ensureSearchIndex } from '@/db/search-index';
import { purgeExpiredTrash } from '@/features/notes/repository';
import { warmUpKvStorage } from '@/lib/kv-storage';
import { useSettingsStore } from '@/stores/settings-store';
import { spacing, useTheme } from '@/theme';

import migrations from '../../drizzle/migrations';

/**
 * Prepara todo lo necesario antes de renderizar la app:
 * 1. abre el almacén de preferencias e hidrata los ajustes,
 * 2. abre la base de datos,
 * 3. aplica las migraciones pendientes,
 * 4. prepara el índice de búsqueda (solo nativo) y purga la papelera caducada.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      await warmUpKvStorage();
      await useSettingsStore.persist.rehydrate();
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
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <Text variant="heading">No se pudo abrir la base de datos</Text>
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
