import { Platform } from 'react-native';

export const palette = {
  light: {
    background: '#FAFAF7',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F1EC',
    surfacePressed: '#E6E6E0',
    border: '#E2E2DC',
    text: '#1C1C1A',
    textSecondary: '#63635E',
    textMuted: '#8E8E88',
    primary: '#E0A100',
    onPrimary: '#1C1C1A',
    danger: '#D13B3B',
    success: '#2E9E5B',
  },
  dark: {
    background: '#121211',
    surface: '#1C1C1A',
    surfaceMuted: '#262624',
    surfacePressed: '#31312E',
    border: '#34342F',
    text: '#F2F2EE',
    textSecondary: '#B4B4AD',
    textMuted: '#85857F',
    primary: '#F5B91F',
    onPrimary: '#1C1C1A',
    danger: '#F06A6A',
    success: '#5BC285',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type ThemeColors = { [K in keyof (typeof palette)['light']]: string };

/**
 * Colores de nota. En la base de datos se guarda el token (`'yellow'`), nunca el hex,
 * para que cada nota se adapte al tema claro u oscuro.
 */
export const NOTE_COLOR_TOKENS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'brown',
  'gray',
] as const;

export type NoteColor = (typeof NOTE_COLOR_TOKENS)[number];

export const noteColors: Record<ColorScheme, Record<NoteColor, string>> = {
  light: {
    default: palette.light.surface,
    red: '#FAD4D0',
    orange: '#FBE1C6',
    yellow: '#FFF2B8',
    green: '#D9F0C9',
    teal: '#CDEDE7',
    blue: '#D3E5F8',
    purple: '#E3DAF5',
    pink: '#F8D7E7',
    brown: '#EADDD0',
    gray: '#E6E6E3',
  },
  dark: {
    default: palette.dark.surface,
    red: '#5A2A27',
    orange: '#5C3B1E',
    yellow: '#5A4C1A',
    green: '#2D4A2A',
    teal: '#1F4743',
    blue: '#213D5C',
    purple: '#3A2F57',
    pink: '#55293F',
    brown: '#4A3A2D',
    gray: '#3A3A37',
  },
};

export const noteColorLabels: Record<NoteColor, string> = {
  default: 'Sin color',
  red: 'Rojo',
  orange: 'Naranja',
  yellow: 'Amarillo',
  green: 'Verde',
  teal: 'Turquesa',
  blue: 'Azul',
  purple: 'Morado',
  pink: 'Rosa',
  brown: 'Marrón',
  gray: 'Gris',
};

export function isNoteColor(value: unknown): value is NoteColor {
  return typeof value === 'string' && (NOTE_COLOR_TOKENS as readonly string[]).includes(value);
}

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = Platform.select({
  ios: { sans: 'system-ui', rounded: 'ui-rounded', mono: 'ui-monospace' },
  web: {
    sans: 'Inter, ui-sans-serif, system-ui, sans-serif',
    rounded: 'ui-rounded, system-ui, sans-serif',
    mono: 'ui-monospace, Menlo, monospace',
  },
  default: { sans: 'normal', rounded: 'normal', mono: 'monospace' },
});

export const typography = {
  largeTitle: { fontSize: 32, lineHeight: 38, fontWeight: '700' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Ancho máximo del contenido en pantallas grandes (tablet, web). */
export const MAX_CONTENT_WIDTH = 840;
