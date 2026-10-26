import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { lastSyncedAt, syncIfPending, syncNow } from '../engine';
import { useSyncStore } from '../store';
import { getSupabase } from '../supabase';
import { SYNC_TABLES } from '../tables';

const SYNCED_TABLES = new Set<string>(Object.values(SYNC_TABLES).map((t) => t.name));
/** Espera tras un cambio local antes de subirlo (el autoguardado escribe a menudo). */
const CHANGE_DEBOUNCE_MS = 3000;
/**
 * Con la app en primer plano, se baja lo nuevo de otros dispositivos cada cierto tiempo. Con
 * Realtime conectado es solo una red de seguridad (por si se pierde algún aviso).
 */
const POLL_INTERVAL_MS = 60_000;
const REALTIME_POLL_INTERVAL_MS = 5 * 60_000;
/** Agrupa los avisos de Realtime que llegan seguidos (un lote de cambios = varias filas). */
const REALTIME_DEBOUNCE_MS = 400;

/**
 * Sincronización en marcha mientras hay sesión: al entrar, al volver a primer plano, tras los
 * cambios locales, al instante cuando otro dispositivo cambia algo (Supabase Realtime) y, como
 * red de seguridad, cada cierto tiempo con la app abierta. Sin Supabase configurado no hace nada.
 */
export function SyncRuntime() {
  const accountId = useSyncStore((s) => s.account?.id);
  const realtime = useSyncStore((s) => s.realtime);

  // La sesión (y con ella la base de datos local) la gestiona `AuthRuntime`; este componente se
  // monta con la base de datos de la cuenta ya abierta.
  useEffect(() => {
    if (accountId) useSyncStore.getState().setStatus('idle', lastSyncedAt(accountId) ?? undefined);
  }, [accountId]);

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
    return () => {
      if (timer) clearTimeout(timer);
      changes.remove();
      appState.remove();
    };
  }, [accountId]);

  // Realtime: aviso de que cambió algo de esta cuenta en el servidor → se sincroniza enseguida.
  // RLS solo deja recibir las filas propias; el filtro evita además los avisos de otras cuentas.
  useEffect(() => {
    if (!accountId) return;
    const supabase = getSupabase();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`sync-rows-${accountId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sync_rows', filter: `user_id=eq.${accountId}` },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = null;
            void syncNow();
          }, REALTIME_DEBOUNCE_MS);
        },
      )
      .subscribe((status) => {
        useSyncStore.getState().setRealtime(status === 'SUBSCRIBED');
        // Al reconectar se baja lo que se pudo perder mientras tanto.
        if (status === 'SUBSCRIBED') void syncNow();
      });
    return () => {
      if (timer) clearTimeout(timer);
      useSyncStore.getState().setRealtime(false);
      void supabase.removeChannel(channel);
    };
  }, [accountId]);

  useEffect(() => {
    if (!accountId) return;
    const interval = setInterval(
      () => {
        if (AppState.currentState === 'active') void syncNow();
      },
      realtime ? REALTIME_POLL_INTERVAL_MS : POLL_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [accountId, realtime]);

  return null;
}
