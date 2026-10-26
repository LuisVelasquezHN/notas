import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { LanguagePreference } from '@/i18n';
import type { AccentName, EditorTextSize } from '@/theme/tokens';
import { kvStorage } from '@/lib/kv-storage';

export type ThemePreference = 'system' | 'light' | 'dark';
export type NotesLayout = 'list' | 'grid';
export type NotesSortBy = 'updatedAt' | 'createdAt' | 'title' | 'manual';
/** Tiempo en segundo plano tras el que se vuelve a pedir el desbloqueo de la app. */
export type LockAfter = 'immediately' | 'oneMinute' | 'fiveMinutes';

export const LOCK_AFTER_MS: Record<LockAfter, number> = {
  immediately: 0,
  oneMinute: 60_000,
  fiveMinutes: 5 * 60_000,
};

type SettingsState = {
  theme: ThemePreference;
  accent: AccentName;
  editorTextSize: EditorTextSize;
  language: LanguagePreference;
  notesLayout: NotesLayout;
  notesSortBy: NotesSortBy;
  /** Pedir biometría (o el código del dispositivo) al abrir la app. */
  appLock: boolean;
  lockAfter: LockAfter;
  /** Ya se ha visto la presentación inicial. */
  onboarded: boolean;
  /** Enviar informes de errores (sin contenido de las notas; ver `lib/monitoring`). */
  crashReports: boolean;
  setTheme: (theme: ThemePreference) => void;
  setAccent: (accent: AccentName) => void;
  setEditorTextSize: (size: EditorTextSize) => void;
  setLanguage: (language: LanguagePreference) => void;
  setNotesLayout: (layout: NotesLayout) => void;
  setNotesSortBy: (sortBy: NotesSortBy) => void;
  setAppLock: (enabled: boolean) => void;
  setLockAfter: (lockAfter: LockAfter) => void;
  setOnboarded: (onboarded: boolean) => void;
  setCrashReports: (enabled: boolean) => void;
};

/**
 * Preferencias del usuario, persistidas en expo-sqlite/kv-store.
 * La hidratación la lanza `AppBootstrap` antes de mostrar la app (`skipHydration`).
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      accent: 'amber',
      editorTextSize: 'normal',
      language: 'system',
      notesLayout: 'grid',
      notesSortBy: 'updatedAt',
      appLock: false,
      lockAfter: 'immediately',
      onboarded: false,
      crashReports: true,
      setTheme: (theme) => set({ theme }),
      setAccent: (accent) => set({ accent }),
      setEditorTextSize: (editorTextSize) => set({ editorTextSize }),
      setLanguage: (language) => set({ language }),
      setNotesLayout: (notesLayout) => set({ notesLayout }),
      setNotesSortBy: (notesSortBy) => set({ notesSortBy }),
      setAppLock: (appLock) => set({ appLock }),
      setLockAfter: (lockAfter) => set({ lockAfter }),
      setOnboarded: (onboarded) => set({ onboarded }),
      setCrashReports: (crashReports) => set({ crashReports }),
    }),
    {
      name: 'settings',
      version: 2,
      storage: createJSONStorage(() => kvStorage),
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = (persisted ?? {}) as Partial<SettingsState>;
        // v1 (fases 0–4): quien ya usaba la app no tiene que ver la presentación.
        if (version < 2) return { ...state, onboarded: true };
        return state;
      },
    },
  ),
);
