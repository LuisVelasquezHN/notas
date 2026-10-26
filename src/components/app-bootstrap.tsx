import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { openDatabase, type Database } from '@/db';
import type { DataScope } from '@/db/scope';
import { ensureSearchIndex } from '@/db/search-index';
import { acquireDatabaseLock } from '@/db/tab-lock';
import { purgeAttachments } from '@/features/attachments/repository';
import { purgeExpiredTrash } from '@/features/notes/repository';
import { resolveInitialScope } from '@/features/sync/account-scope';
import { useAuthRuntime } from '@/features/sync/components/auth-runtime';
import { applyPendingImport } from '@/features/sync/pending-import';
import { useSyncStore } from '@/features/sync/store';
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
 * 2. averigua si hay sesión y con ella qué base de datos local usar (una por cuenta, otra sin
 *    cuenta, ver `db/scope.ts`); después atiende los cambios de sesión (`useAuthRuntime`),
 * 3. abre esa base de datos y aplica las migraciones pendientes,
 * 4. prepara el índice de búsqueda (solo nativo) y el seguimiento de cambios para sincronizar,
 *    importa lo que venga de otra base de datos, purga la papelera caducada y los ficheros de
 *    adjuntos que ya no se usan.
 * Al cambiar de cuenta, la parte de la base de datos (y la app debajo) se vuelve a montar.
 */
export function AppBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [otherTab, setOtherTab] = useState(false);
  const hydrated = useHydrated();
  const scope = useSyncStore((s) => s.scope);
  useAuthRuntime(ready);

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
      const initial = await resolveInitialScope();
      useSyncStore.getState().setSession(initial.account, initial.scope);
      setReady(true);
    })().catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
  }, []);

  if (!hydrated) return null;
  if (error) return <BootError error={error} />;
  if (otherTab) return <BootOtherTab />;
  if (!ready || !scope) return <BootLoading />;
  return (
    <ScopedDatabase key={scope} scope={scope}>
      {children}
    </ScopedDatabase>
  );
}

/** Base de datos de un ámbito (cuenta o sin cuenta): la abre y, con ella lista, monta la app. */
function ScopedDatabase({ scope, children }: { scope: DataScope; children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDatabase(scope)
      .then((opened) => {
        if (!cancelled) setDb(opened);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e : new Error(String(e))));
    return () => {
      cancelled = true;
    };
  }, [scope]);

  if (error) return <BootError error={error} />;
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
      // Notas que vienen de otra base de datos (p. ej. las de sin cuenta al entrar en una).
      await applyPendingImport();
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
