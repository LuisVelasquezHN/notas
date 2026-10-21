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
  setAccount: (account: Account | null) => void;
  setStatus: (status: SyncStatus, lastSyncedAt?: number) => void;
};

export const useSyncStore = create<SyncState>()((set) => ({
  account: undefined,
  status: 'idle',
  lastSyncedAt: null,
  setAccount: (account) => set({ account }),
  setStatus: (status, lastSyncedAt) =>
    set((s) => ({ status, lastSyncedAt: lastSyncedAt ?? s.lastSyncedAt })),
}));
