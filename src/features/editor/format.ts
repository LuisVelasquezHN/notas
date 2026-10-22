/**
 * Formatos del editor enriquecido. Lo comparten el DOM component de TipTap (que los aplica) y la
 * barra de formato nativa (que los muestra): solo valores serializables, sin dependencias.
 */
export const FORMAT_COMMANDS = [
  'bold',
  'italic',
  'underline',
  'strike',
  'important',
  'heading1',
  'heading2',
  'bulletList',
  'orderedList',
  'taskList',
  'blockquote',
  'code',
  'clear',
] as const;

export type FormatCommand = (typeof FORMAT_COMMANDS)[number];

/**
 * Estilos con valor. Se guardan como token (no como color o fuente concretos), igual que los
 * colores de nota: el editor los convierte en variables CSS que cambian con el tema claro/oscuro.
 */
export const TEXT_COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'pink', 'gray'] as const;
export const HIGHLIGHTS = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple'] as const;
export const FONT_FAMILIES = ['sans', 'serif', 'mono', 'rounded'] as const;
export const FONT_SIZES = ['small', 'normal', 'large', 'xlarge'] as const;

export type TextColor = (typeof TEXT_COLORS)[number];
export type HighlightColor = (typeof HIGHLIGHTS)[number];
export type FontFamilyName = (typeof FONT_FAMILIES)[number];
export type FontSizeName = (typeof FONT_SIZES)[number];

export type StyleKind = 'textColor' | 'highlight' | 'fontFamily' | 'fontSize';

/** Aplicar un estilo con valor; `null` lo quita (vuelve al de por defecto). */
export type StyleAction =
  | { style: 'textColor'; value: TextColor | null }
  | { style: 'highlight'; value: HighlightColor | null }
  | { style: 'fontFamily'; value: FontFamilyName | null }
  | { style: 'fontSize'; value: FontSizeName | null };

export type FormatAction = FormatCommand | StyleAction;

/** Formatos activos en la selección actual (`clear` no tiene estado). */
export type FormatState = Partial<Record<Exclude<FormatCommand, 'clear'>, boolean>> & {
  textColor?: TextColor | null;
  highlight?: HighlightColor | null;
  fontFamily?: FontFamilyName | null;
  fontSize?: FontSizeName | null;
};

const STYLE_KINDS: StyleKind[] = ['textColor', 'highlight', 'fontFamily', 'fontSize'];

export function sameFormatState(a: FormatState, b: FormatState): boolean {
  return (
    FORMAT_COMMANDS.every((c) => c === 'clear' || !!a[c] === !!b[c]) &&
    STYLE_KINDS.every((k) => (a[k] ?? null) === (b[k] ?? null))
  );
}

const VALUES: Record<StyleKind, readonly string[]> = {
  textColor: TEXT_COLORS,
  highlight: HIGHLIGHTS,
  fontFamily: FONT_FAMILIES,
  fontSize: FONT_SIZES,
};

/** Valida una acción que llega por el puente de la webview (JSON sin tipar). */
export function parseFormatAction(value: unknown): FormatAction | null {
  if (typeof value === 'string') {
    return (FORMAT_COMMANDS as readonly string[]).includes(value) ? (value as FormatCommand) : null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const { style, value: v } = value as { style?: unknown; value?: unknown };
  if (typeof style !== 'string' || !(STYLE_KINDS as string[]).includes(style)) return null;
  if (v !== null && (typeof v !== 'string' || !VALUES[style as StyleKind].includes(v))) return null;
  return { style, value: v } as StyleAction;
}

/**
 * En el documento, cada token se guarda como una variable CSS (`var(--lv-text-red)`): así el
 * texto cambia con el tema y los valores que llegan de fuera (otra copia, la sincronización) no
 * pueden inyectar CSS arbitrario, porque solo se reconocen estos.
 */
export const styleVar = (kind: StyleKind, token: string) =>
  `var(--lv-${kind === 'textColor' ? 'text' : kind === 'highlight' ? 'mark' : kind === 'fontFamily' ? 'font' : 'size'}-${token})`;

/** Token a partir de la variable CSS guardada (o `null` si no es una de las conocidas). */
export function tokenFromVar(kind: StyleKind, css: unknown): string | null {
  if (typeof css !== 'string') return null;
  return VALUES[kind].find((token) => styleVar(kind, token) === css) ?? null;
}

/** Valores concretos de cada token (tema claro y oscuro). Los usan el editor y el PDF. */
export const STYLE_VALUES = {
  textColor: {
    light: {
      red: '#D13B3B',
      orange: '#C25E00',
      green: '#2E7D32',
      blue: '#1F6FD1',
      purple: '#7B3FC4',
      pink: '#C2185B',
      gray: '#6B6B66',
    },
    dark: {
      red: '#FF7B72',
      orange: '#FFA657',
      green: '#7EE787',
      blue: '#79C0FF',
      purple: '#D2A8FF',
      pink: '#FF8FC7',
      gray: '#A8A8A2',
    },
  },
  highlight: {
    light: {
      yellow: '#FFF3A3',
      green: '#C8F2C2',
      blue: '#CDE4FF',
      pink: '#FFD1E6',
      orange: '#FFDDB8',
      purple: '#E6D6FF',
    },
    dark: {
      yellow: 'rgba(255, 214, 10, 0.35)',
      green: 'rgba(63, 185, 80, 0.35)',
      blue: 'rgba(56, 139, 253, 0.35)',
      pink: 'rgba(219, 97, 162, 0.35)',
      orange: 'rgba(219, 109, 40, 0.35)',
      purple: 'rgba(163, 113, 247, 0.35)',
    },
  },
  fontFamily: {
    sans: '-apple-system, system-ui, Roboto, "Segoe UI", sans-serif',
    serif: 'Georgia, "Times New Roman", serif',
    mono: 'ui-monospace, Menlo, Consolas, monospace',
    rounded: '"SF Pro Rounded", ui-rounded, "Nunito", "Varela Round", system-ui, sans-serif',
  },
  fontSize: { small: '0.85em', normal: '1em', large: '1.25em', xlarge: '1.5em' },
} as const;

/** Variables CSS de todos los tokens para un tema. */
export function styleVariables(scheme: 'light' | 'dark'): string {
  const lines: string[] = [];
  for (const [token, value] of Object.entries(STYLE_VALUES.textColor[scheme])) {
    lines.push(`--lv-text-${token}: ${value};`);
  }
  for (const [token, value] of Object.entries(STYLE_VALUES.highlight[scheme])) {
    lines.push(`--lv-mark-${token}: ${value};`);
  }
  for (const [token, value] of Object.entries(STYLE_VALUES.fontFamily)) {
    lines.push(`--lv-font-${token}: ${value};`);
  }
  for (const [token, value] of Object.entries(STYLE_VALUES.fontSize)) {
    lines.push(`--lv-size-${token}: ${value};`);
  }
  return lines.join('\n');
}
