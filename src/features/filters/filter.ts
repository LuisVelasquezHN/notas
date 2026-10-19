import { NOTE_TYPES, type NoteType } from '@/db/schema';
import { DAY_MS } from '@/lib/dates';
import { NOTE_COLOR_TOKENS, type NoteColor } from '@/theme/tokens';

/** Antigüedad máxima de la última modificación. Es relativa: una carpeta inteligente no caduca. */
export const MODIFIED_WITHIN = ['day', 'week', 'month', 'year'] as const;
export type ModifiedWithin = (typeof MODIFIED_WITHIN)[number];

export const MODIFIED_WITHIN_LABELS: Record<ModifiedWithin, string> = {
  day: 'Últimas 24 horas',
  week: 'Últimos 7 días',
  month: 'Últimos 30 días',
  year: 'Último año',
};

const MODIFIED_WITHIN_DAYS: Record<ModifiedWithin, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};

/**
 * Filtro combinable de notas. Se guarda tal cual (JSON) en `saved_filters.query_json`.
 * Dentro de cada criterio los valores se combinan con "o" (rojo o azul) y los criterios entre sí
 * con "y" (rojas o azules **y** con la etiqueta X). Un criterio vacío no filtra.
 */
export type NoteFilter = {
  search?: string;
  types?: NoteType[];
  colors?: NoteColor[];
  tagIds?: string[];
  folderIds?: string[];
  favorite?: boolean;
  hasReminder?: boolean;
  hasAttachments?: boolean;
  modifiedWithin?: ModifiedWithin;
  /** Incluye las notas archivadas además de las activas. */
  includeArchived?: boolean;
};

export const EMPTY_FILTER: NoteFilter = {};

export function modifiedSince(within: ModifiedWithin, now: number = Date.now()): number {
  return now - MODIFIED_WITHIN_DAYS[within] * DAY_MS;
}

/** Número de criterios activos (sin contar el texto ni "incluir archivadas"). */
export function activeCriteriaCount(filter: NoteFilter): number {
  return [
    filter.types?.length,
    filter.colors?.length,
    filter.tagIds?.length,
    filter.folderIds?.length,
    filter.favorite,
    filter.hasReminder,
    filter.hasAttachments,
    filter.modifiedWithin,
  ].filter(Boolean).length;
}

export function isFilterEmpty(filter: NoteFilter): boolean {
  return activeCriteriaCount(filter) === 0 && !filter.search?.trim();
}

/** Añade o quita `value` de una lista (para los chips de los filtros). */
export function toggleValue<T>(list: readonly T[] | undefined, value: T): T[] {
  const current = list ?? [];
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

const isString = (v: unknown): v is string => typeof v === 'string';

function stringList<T extends string>(value: unknown, allowed?: readonly T[]): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = [
    ...new Set(value.filter(isString).filter((v) => !allowed || allowed.includes(v as T))),
  ];
  return list.length > 0 ? (list as T[]) : undefined;
}

/**
 * Normaliza un filtro: quita criterios vacíos, valores desconocidos y duplicados.
 * Se usa al guardar y al leer de la base de datos (datos de versiones anteriores o corruptos).
 */
export function normalizeFilter(input: unknown): NoteFilter {
  if (typeof input !== 'object' || input === null) return {};
  const raw = input as Record<string, unknown>;
  const filter: NoteFilter = {};
  if (isString(raw.search) && raw.search.trim()) filter.search = raw.search.trim();
  const types = stringList(raw.types, NOTE_TYPES);
  if (types) filter.types = types;
  const colors = stringList(raw.colors, NOTE_COLOR_TOKENS);
  if (colors) filter.colors = colors;
  const tagIds = stringList(raw.tagIds);
  if (tagIds) filter.tagIds = tagIds;
  const folderIds = stringList(raw.folderIds);
  if (folderIds) filter.folderIds = folderIds;
  if (raw.favorite === true) filter.favorite = true;
  if (raw.hasReminder === true) filter.hasReminder = true;
  if (raw.hasAttachments === true) filter.hasAttachments = true;
  if (MODIFIED_WITHIN.includes(raw.modifiedWithin as ModifiedWithin)) {
    filter.modifiedWithin = raw.modifiedWithin as ModifiedWithin;
  }
  if (raw.includeArchived === true) filter.includeArchived = true;
  return filter;
}

export function serializeFilter(filter: NoteFilter): string {
  return JSON.stringify(normalizeFilter(filter));
}

export function parseFilter(json: string | null | undefined): NoteFilter {
  if (!json) return {};
  try {
    return normalizeFilter(JSON.parse(json));
  } catch {
    return {};
  }
}

const TYPE_LABELS: Record<NoteType, string> = {
  text: 'Texto',
  checklist: 'Lista',
  image: 'Imagen',
  audio: 'Voz',
};

const COLOR_LABELS: Record<NoteColor, string> = {
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

export type FilterPart = {
  key: string;
  label: string;
  /** El filtro sin este valor (para quitarlo desde su chip). */
  without: NoteFilter;
};

type NameLookup = {
  tag: (id: string) => string | undefined;
  folder: (id: string) => string | undefined;
};

/**
 * Desglosa un filtro en partes legibles ("Rojo", "#trabajo", "Favoritas"…), cada una con el
 * filtro resultante de quitarla. Los IDs que ya no existen (etiqueta o carpeta borrada) se omiten.
 */
export function describeFilter(filter: NoteFilter, names: NameLookup): FilterPart[] {
  const parts: FilterPart[] = [];
  const list = <K extends 'types' | 'colors' | 'tagIds' | 'folderIds'>(
    key: K,
    label: (value: NonNullable<NoteFilter[K]>[number]) => string | undefined,
  ) => {
    const values = (filter[key] ?? []) as NonNullable<NoteFilter[K]>[number][];
    for (const value of values) {
      const text = label(value);
      if (!text) continue;
      const rest = values.filter((v) => v !== value);
      parts.push({
        key: `${key}:${value}`,
        label: text,
        without: { ...filter, [key]: rest.length > 0 ? rest : undefined },
      });
    }
  };
  list('types', (t) => TYPE_LABELS[t]);
  list('colors', (c) => COLOR_LABELS[c]);
  list('tagIds', (id) => {
    const name = names.tag(id);
    return name ? `#${name}` : undefined;
  });
  list('folderIds', (id) => names.folder(id));
  if (filter.modifiedWithin) {
    parts.push({
      key: 'modifiedWithin',
      label: MODIFIED_WITHIN_LABELS[filter.modifiedWithin],
      without: { ...filter, modifiedWithin: undefined },
    });
  }
  const flags = [
    ['favorite', 'Favoritas'],
    ['hasReminder', 'Con recordatorio'],
    ['hasAttachments', 'Con adjuntos'],
    ['includeArchived', 'Incluye archivadas'],
  ] as const;
  for (const [key, label] of flags) {
    if (filter[key]) parts.push({ key, label, without: { ...filter, [key]: undefined } });
  }
  return parts;
}
