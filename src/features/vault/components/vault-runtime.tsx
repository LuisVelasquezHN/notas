import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { vaultsQuery } from '../repository';
import { useVaultStore } from '../store';

/** Tiempo fuera de la app tras el que la bóveda se vuelve a bloquear. */
const AUTO_LOCK_MS = 60_000;

/**
 * Bloquea las notas seguras al volver a la app tras más de un minuto fuera, y si la bóveda
 * desbloqueada deja de existir (se borró en otro dispositivo o al cerrar sesión).
 */
export function VaultRuntime() {
  const primaryId = useVaultStore((s) => s.primaryId);
  const { data: vaults } = useLiveQuery(vaultsQuery());

  useEffect(() => {
    let leftAt: number | null = null;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (leftAt !== null && Date.now() - leftAt > AUTO_LOCK_MS) useVaultStore.getState().lock();
        leftAt = null;
      } else if (leftAt === null) {
        leftAt = Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  // Solo cuenta si la bóveda estaba y ya no está: recién creada, la consulta aún no la incluye.
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const ids = new Set(vaults.map((v) => v.id));
    if (primaryId && seen.current.has(primaryId) && !ids.has(primaryId)) {
      useVaultStore.getState().lock();
    }
    seen.current = ids;
  }, [primaryId, vaults]);

  return null;
}
