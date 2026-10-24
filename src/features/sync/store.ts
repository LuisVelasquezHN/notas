import { create } from 'zustand';

export type Account = {
  id: string;
  email: string | null;
  name: string | null;
};

export type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  /** `undefined`: aún no se sabe si hay sesión. */
  account: Account | null | undefined;
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Conectado a Supabase Realtime: los cambios de otros dispositivos llegan al momento. */
  realtime: boolean;
  setAccount: (account: Account | null) => void;
  setStatus: (status: SyncStatus, lastSyncedAt?: number) => void;
  setRealtime: (realtime: boolean) => void;
};

export const useSyncStore = create<SyncState>()((set) => ({
  account: undefined,
  status: 'idle',
  lastSyncedAt: null,
  realtime: false,
  setAccount: (account) => set({ account }),
  setRealtime: (realtime) => set({ realtime }),
  setStatus: (status, lastSyncedAt) =>
    set((s) => ({ status, lastSyncedAt: lastSyncedAt ?? s.lastSyncedAt })),
}));
