import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DataScope } from '@/db/scope';
import { kvStorage } from '@/lib/kv-storage';

/** Búsquedas recientes que se recuerdan por cuenta. */
export const MAX_RECENT_SEARCHES = 8;

type RecentSearchesState = {
  /** Por ámbito de datos: cada cuenta (y el uso sin cuenta) ve solo las suyas. */
  byScope: Record<DataScope, string[]>;
  add: (scope: DataScope, query: string) => void;
  remove: (scope: DataScope, query: string) => void;
  clear: (scope: DataScope) => void;
};

/** La búsqueda más reciente primero, sin repetidas (sin distinguir mayúsculas). */
export function withRecent(list: string[], query: string, max = MAX_RECENT_SEARCHES): string[] {
  const value = query.trim().replace(/\s+/g, ' ');
  if (value.length < 2) return list;
  const key = value.toLocaleLowerCase();
  return [value, ...list.filter((q) => q.toLocaleLowerCase() !== key)].slice(0, max);
}

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      byScope: {},
      add: (scope, query) =>
        set((s) => ({
          byScope: { ...s.byScope, [scope]: withRecent(s.byScope[scope] ?? [], query) },
        })),
      remove: (scope, query) =>
        set((s) => ({
          byScope: { ...s.byScope, [scope]: (s.byScope[scope] ?? []).filter((q) => q !== query) },
        })),
      clear: (scope) =>
        set((s) => {
          const { [scope]: _removed, ...rest } = s.byScope;
          return { byScope: rest };
        }),
    }),
    {
      name: 'recent-searches',
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ byScope: s.byScope }),
      // Como los ajustes: se cargan en `AppBootstrap`, con el almacén ya abierto.
      skipHydration: true,
    },
  ),
);
