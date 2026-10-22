import type { AESEncryptionKey } from 'expo-crypto';
import { create } from 'zustand';

/**
 * Claves de datos de las bóvedas desbloqueadas. Solo viven en memoria (nunca se guardan: al
 * cerrar la app o bloquear, desaparecen). `primaryId`: la bóveda en la que se guardan las notas.
 */
type VaultState = {
  keys: Record<string, AESEncryptionKey> | null;
  primaryId: string | null;
  setUnlocked: (keys: Record<string, AESEncryptionKey>, primaryId: string) => void;
  lock: () => void;
};

export const useVaultStore = create<VaultState>()((set) => ({
  keys: null,
  primaryId: null,
  setUnlocked: (keys, primaryId) => set({ keys, primaryId }),
  lock: () => set({ keys: null, primaryId: null }),
}));

export const lockVault = () => useVaultStore.getState().lock();
