import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/lib/kv-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NotesLayout = 'list' | 'grid';
export type NotesSortBy = 'updatedAt' | 'createdAt' | 'title' | 'manual';

type SettingsState = {
  theme: ThemePreference;
  notesLayout: NotesLayout;
  notesSortBy: NotesSortBy;
  setTheme: (theme: ThemePreference) => void;
  setNotesLayout: (layout: NotesLayout) => void;
  setNotesSortBy: (sortBy: NotesSortBy) => void;
};

/**
 * Preferencias del usuario, persistidas en expo-sqlite/kv-store.
 * La hidratación la lanza `AppBootstrap` antes de mostrar la app (`skipHydration`).
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      notesLayout: 'grid',
      notesSortBy: 'updatedAt',
      setTheme: (theme) => set({ theme }),
      setNotesLayout: (notesLayout) => set({ notesLayout }),
      setNotesSortBy: (notesSortBy) => set({ notesSortBy }),
    }),
    {
      name: 'settings',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      skipHydration: true,
    },
  ),
);
