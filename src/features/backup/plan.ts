import { parseFilter, serializeFilter } from '@/features/filters/filter';

import type { BackupData, NoteTag } from './format';

/**
 * Fusión de una copia con los datos del dispositivo (función pura, sin base de datos):
 * - una fila que no existe se añade;
 * - una que ya existe se sustituye solo si la de la copia es más reciente (`updatedAt`);
 * - las filas que apuntan a algo que no existe ni aquí ni en la copia se descartan (o, si la
 *   referencia es opcional, se quedan sin ella);
 * - una etiqueta de la copia con el mismo nombre que una local (sin distinguir mayúsculas) se
 *   funde con la local.
 * Nada se borra: importar dos veces la misma copia no cambia nada.
 */

type Stamped = { id: string; updatedAt: number };

export type LocalIndex = {
  /** `id → updatedAt` de lo que ya hay en cada tabla. */
  stamps: Record<Exclude<keyof BackupData, 'noteTags'>, Map<string, number>>;
  /** Etiquetas locales (para fundir por nombre). */
  tagNames: { id: string; name: string }[];
  /** Pares `noteId|tagId` que ya existen. */
  noteTagKeys: Set<string>;
};

export type TablePlan<T> = { insert: T[]; update: T[] };

export type ImportPlan = {
  [K in keyof BackupData]: TablePlan<BackupData[K][number]>;
} & {
  /** Etiquetas de la copia que se funden con una local: `id de la copia → id local`. */
  tagIdMap: Map<string, string>;
};

function split<T extends Stamped>(rows: T[], local: Map<string, number>): TablePlan<T> {
  const plan: TablePlan<T> = { insert: [], update: [] };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    const current = local.get(row.id);
    if (current === undefined) plan.insert.push(row);
    else if (row.updatedAt > current) plan.update.push(row);
  }
  return plan;
}

/** Carpetas en un orden en que cada padre va antes que sus hijas (para las claves foráneas). */
function parentsFirst<T extends { id: string; parentId: string | null }>(rows: T[]): T[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const done = new Set<string>();
  const result: T[] = [];
  const visit = (row: T, path: Set<string>) => {
    if (done.has(row.id) || path.has(row.id)) return;
    path.add(row.id);
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) visit(parent, path);
    done.add(row.id);
    result.push(row);
  };
  for (const row of rows) visit(row, new Set());
  return result;
}

export function planImport(data: BackupData, local: LocalIndex): ImportPlan {
  // Etiquetas: por nombre, la local manda.
  const localByName = new Map(local.tagNames.map((t) => [t.name.toLocaleLowerCase(), t.id]));
  const tagIdMap = new Map<string, string>();
  const tagsToMerge = data.tags.filter((tag) => {
    const localId = localByName.get(tag.name.toLocaleLowerCase());
    if (localId && localId !== tag.id) {
      tagIdMap.set(tag.id, localId);
      return false;
    }
    return true;
  });
  const mapTag = (id: string) => tagIdMap.get(id) ?? id;

  const known = (table: keyof LocalIndex['stamps'], rows: Stamped[]) =>
    new Set([...local.stamps[table].keys(), ...rows.map((r) => r.id)]);

  // Carpetas: un padre desconocido (o un ciclo) deja la carpeta en la raíz.
  const folderIds = known('folders', data.folders);
  const folders = parentsFirst(
    data.folders.map((f) =>
      f.parentId && (!folderIds.has(f.parentId) || f.parentId === f.id)
        ? { ...f, parentId: null }
        : f,
    ),
  );

  const notes = data.notes.map((n) =>
    n.folderId && !folderIds.has(n.folderId) ? { ...n, folderId: null } : n,
  );
  const noteIds = known('notes', notes);
  const items = data.checklistItems.filter((i) => noteIds.has(i.noteId));
  const itemIds = known('checklistItems', items);

  const tagIds = known('tags', tagsToMerge);
  const seenPairs = new Set(local.noteTagKeys);
  const noteTags: NoteTag[] = [];
  for (const pair of data.noteTags) {
    const tagId = mapTag(pair.tagId);
    const key = `${pair.noteId}|${tagId}`;
    if (!noteIds.has(pair.noteId) || !tagIds.has(tagId) || seenPairs.has(key)) continue;
    seenPairs.add(key);
    noteTags.push({ ...pair, tagId });
  }

  const reminders = data.reminders
    .filter((r) => noteIds.has(r.noteId) && (!r.checklistItemId || itemIds.has(r.checklistItemId)))
    // El identificador de la notificación es de otro dispositivo: el scheduler la vuelve a crear.
    .map((r) => ({ ...r, osNotificationId: null }));

  const attachments = data.attachments.filter((a) => noteIds.has(a.noteId) && a.file !== null);

  // Carpetas inteligentes: los filtros por una etiqueta fundida pasan a la local.
  const savedFilters = data.savedFilters.map((s) => {
    const filter = parseFilter(s.queryJson);
    if (!filter.tagIds?.some((id) => tagIdMap.has(id))) return s;
    return {
      ...s,
      queryJson: serializeFilter({ ...filter, tagIds: [...new Set(filter.tagIds.map(mapTag))] }),
    };
  });

  return {
    folders: split(folders, local.stamps.folders),
    notes: split(notes, local.stamps.notes),
    checklistItems: split(items, local.stamps.checklistItems),
    tags: split(tagsToMerge, local.stamps.tags),
    noteTags: { insert: noteTags, update: [] },
    reminders: split(reminders, local.stamps.reminders),
    attachments: split(attachments, local.stamps.attachments),
    savedFilters: split(savedFilters, local.stamps.savedFilters),
    tagIdMap,
  };
}
