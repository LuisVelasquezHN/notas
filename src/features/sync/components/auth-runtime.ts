import { useEffect } from 'react';

import { scopeForSessionChange } from '../account-scope';
import { accountFromSession } from '../auth';
import { useSyncStore } from '../store';
import { getSupabase, isSyncConfigured } from '../supabase';

/**
 * Escucha los cambios de sesión (entrar, salir, caducar) y cambia la base de datos local al ámbito
 * que toca. Los cambios se encadenan: mientras se pregunta si pasar las notas sin cuenta, no se
 * atiende otro.
 */
export function useAuthRuntime(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !isSyncConfigured) return;
    let chain: Promise<void> = Promise.resolve();
    const { data } = getSupabase().auth.onAuthStateChange((_event, session) => {
      const next = accountFromSession(session);
      // Fuera del callback: Supabase desaconseja esperar a otras operaciones dentro de él.
      chain = chain
        .then(() => new Promise((resolve) => setTimeout(resolve, 0)))
        .then(async () => {
          const store = useSyncStore.getState();
          if (store.account !== undefined && store.account?.id === next?.id) return;
          const scope = await scopeForSessionChange(next, store.scope);
          useSyncStore.getState().setSession(next, scope);
        })
        .catch((e: unknown) => console.warn('Cuenta: error al cambiar de sesión', e));
    });
    return () => data.subscription.unsubscribe();
  }, [enabled]);
}
