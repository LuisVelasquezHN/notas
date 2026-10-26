import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';

import { useMemo } from 'react';

import { ACCENTS, noteColors, palette, type ColorScheme, type NoteColor } from './tokens';

export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.theme);
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const scheme = useColorSchemeName();
  const accentName = useSettingsStore((s) => s.accent);
  const colors = useMemo(() => {
    const accent = ACCENTS[accentName] ?? ACCENTS.amber;
    return {
      ...palette[scheme],
      primary: scheme === 'dark' ? accent.dark : accent.light,
      onPrimary: scheme === 'dark' ? accent.onDark : accent.onLight,
    };
  }, [scheme, accentName]);
  return {
    scheme,
    colors,
    noteColor: (token: NoteColor) => noteColors[scheme][token],
  };
}
