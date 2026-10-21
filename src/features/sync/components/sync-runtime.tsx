import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { accountFromSession } from '../auth';
import { lastSyncedAt, syncIfPending, syncNow } from '../engine';
import { useSyncStore } from '../store';
import { getSupabase, isSyncConfigured } from '../supabase';
import { SYNC_TABLES } from '../tables';

const SYNCED_TABLES = new Set<string>(Object.values(SYNC_TABLES).map((t) => t.name));
/** Espera tras un cambio local antes de subirlo (el autoguardado escribe a menudo). */
const CHANGE_DEBOUNCE_MS = 3000;
/** Con la app en primer plano, se baja lo nuevo de otros dispositivos cada cierto tiempo. */
const POLL_INTERVAL_MS = 60_000;

/**
 * Sincronización en marcha mientras hay sesión: al entrar, al volver a primer plano, tras los
 * cambios locales y cada minuto con la app abierta. Sin Supabase configurado no hace nada.
 */
export function SyncRuntime() {
  const accountId = useSyncStore((s) => s.account?.id);

  useEffect(() => {
    if (!isSyncConfigured) {
      useSyncStore.getState().setAccount(null);
      return;
    }
    const supabase = getSupabase();
    const apply = (session: Parameters<typeof accountFromSession>[0]) => {
      const next = accountFromSession(session);
      const store = useSyncStore.getState();
      if (store.account !== undefined && store.account?.id === next?.id) return;
      store.setAccount(next);
      if (next) store.setStatus('idle', lastSyncedAt(next.id) ?? undefined);
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    void syncNow();

    let timer: ReturnType<typeof setTimeout> | null = null;
    const changes = addDatabaseChangeListener(({ tableName }) => {
      if (!SYNCED_TABLES.has(tableName)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void syncIfPending();
      }, CHANGE_DEBOUNCE_MS);
    });
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
      // Al salir de la app se sube lo pendiente.
      else if (state === 'background') void syncIfPending();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timer) clearTimeout(timer);
      changes.remove();
      appState.remove();
      clearInterval(interval);
    };
  }, [accountId]);

  return null;
}
