import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settings-store';

import { noteColors, palette, type ColorScheme, type NoteColor } from './tokens';

export function useColorSchemeName(): ColorScheme {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.theme);
  if (preference !== 'system') return preference;
  return system === 'dark' ? 'dark' : 'light';
}

export function useTheme() {
  const scheme = useColorSchemeName();
  return {
    scheme,
    colors: palette[scheme],
    noteColor: (token: NoteColor) => noteColors[scheme][token],
  };
}
