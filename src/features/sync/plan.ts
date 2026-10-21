import { getTableColumns } from 'drizzle-orm';

import { sanitizeRows } from '@/features/backup/format';
import { parentsFirst } from '@/features/backup/plan';
import { parseFilter, serializeFilter } from '@/features/filters/filter';

import {
  LOCAL_ONLY_COLUMNS,
  SYNC_TABLES,
  SYNC_TABLE_KEYS,
  noteTagId,
  splitNoteTagId,
  tableKeyFromName,
  type SyncTableKey,
} from './tables';

/**
 * Qué hacer con los cambios que llegan del servidor (función pura, sin base de datos).
 *
 * - Gana la versión más reciente (`updatedAt`; en `note_tags`, `createdAt`). Si la fila tiene un
 *   cambio local pendiente igual o más reciente, se ignora la del servidor: la local se subirá
 *   después y el servidor la aceptará. Si la del servidor es más reciente, se aplica y el cambio
 *   pendiente se descarta.
 * - Las lápidas (`deleted`) borran la fila del todo.
 * - Las filas que apuntan a algo que no existe se descartan (o se quedan sin la referencia, si
 *   es opcional), como al importar una copia.
 * - Dos etiquetas con el mismo nombre (creadas en dos dispositivos): se queda la de id menor
 *   (UUID v7: la más antigua) en todos los dispositivos; la otra se funde con ella.
 */

export type RemoteChange = {
  tbl: string;
  rowId: string;
  updatedAt: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
  seq: number;
};

export type Row = Record<string, unknown>;

export type PendingChange = { changedAt: number; deleted: boolean };

export type LocalSnapshot = {
  /** Ids existentes de las tablas a las que apuntan otras (para las claves foráneas). */
  ids: Record<'folders' | 'notes' | 'checklistItems' | 'tags', Set<string>>;
  /** Filas locales de las que llegan cambios, por `rowKey`. */
  rows: Map<string, Row>;
  /** Cambios locales pendientes de subir, por `rowKey`. */
  pending: Map<string, PendingChange>;
  /** Todas las etiquetas locales (también en la papelera): el nombre es único. */
  tags: { id: string; name: string }[];
};

export type Upsert = {
  key: SyncTableKey;
  row: Row;
  /** La fila se cambió al aplicarla (p. ej. una etiqueta fundida): hay que subirla. */
  track: boolean;
};

export type PullPlan = {
  upserts: Upsert[];
  deletes: { key: SyncTableKey; rowId: string }[];
  /** Cambios pendientes que pierden frente al servidor. */
  dropPending: { tbl: string; rowId: string }[];
  /** Etiqueta local `from` que se funde con `to` (sus notas pasan a `to` y `from` se borra). */
  tagMerges: { from: string; to: string }[];
};

export const rowKey = (tbl: string, rowId: string) => `${tbl}:${rowId}`;

/**
 * Ids que se aceptan del servidor (UUID v7 y similares; en `note_tags`, `nota|etiqueta`). El id de
 * un adjunto forma parte del nombre de su fichero: así no puede salirse de la carpeta.
 */
const SAFE_ID = /^[A-Za-z0-9_-]{1,64}(\|[A-Za-z0-9_-]{1,64})?$/;

export function rowIdOf(key: SyncTableKey, row: Row): string {
  return key === 'noteTags' ? noteTagId(String(row.noteId), String(row.tagId)) : String(row.id);
}

/** Versión de una fila: lo que se compara para decidir cuál gana. */
export function versionOf(key: SyncTableKey, row: Row): number {
  return Number(key === 'noteTags' ? row.createdAt : row.updatedAt);
}

/** La fila sin las columnas que solo valen en este dispositivo (lo que se sube). */
export function toRemoteData(key: SyncTableKey, row: Row): Row {
  const data = { ...row };
  for (const column of LOCAL_ONLY_COLUMNS[key] ?? []) delete data[column];
  return data;
}

/** Valida los datos del servidor y rellena las columnas locales (con el valor local, si hay). */
function toLocalRow(key: SyncTableKey, data: Row, local: Row | undefined): Row | null {
  const filled = { ...data };
  for (const column of LOCAL_ONLY_COLUMNS[key] ?? []) {
    // `localUri` vacío: el fichero se descarga antes de aplicar (ver `engine.ts`).
    filled[column] = local?.[column] ?? (column === 'localUri' ? '' : null);
  }
  const [row] = sanitizeRows<Row>(SYNC_TABLES[key].table, [filled]);
  return row ?? null;
}

function sameRow(key: SyncTableKey, a: Row, b: Row): boolean {
  const local = new Set(LOCAL_ONLY_COLUMNS[key] ?? []);
  return Object.keys(getTableColumns(SYNC_TABLES[key].table)).every(
    (column) => local.has(column) || (a[column] ?? null) === (b[column] ?? null),
  );
}

export function planPull(changes: RemoteChange[], local: LocalSnapshot): PullPlan {
  // Solo cuenta el último cambio de cada fila.
  const latest = new Map<string, RemoteChange>();
  for (const change of [...changes].sort((a, b) => a.seq - b.seq)) {
    latest.set(rowKey(change.tbl, change.rowId), change);
  }

  const dropPending: PullPlan['dropPending'] = [];
  const candidates = new Map<SyncTableKey, Row[]>();
  const deletes = new Map<SyncTableKey, string[]>();

  for (const change of latest.values()) {
    const key = tableKeyFromName(change.tbl);
    if (!key || !SAFE_ID.test(change.rowId)) continue;
    const k = rowKey(change.tbl, change.rowId);
    const localRow = local.rows.get(k);
    const pending = local.pending.get(k);
    if (pending) {
      const localVersion =
        pending.deleted || !localRow ? pending.changedAt : versionOf(key, localRow);
      if (localVersion >= change.updatedAt) continue;
      dropPending.push({ tbl: change.tbl, rowId: change.rowId });
    }
    if (change.deleted || !change.data) {
      if (localRow) deletes.set(key, [...(deletes.get(key) ?? []), change.rowId]);
      continue;
    }
    const row = toLocalRow(key, change.data, localRow);
    if (!row || rowIdOf(key, row) !== change.rowId) continue;
    if (key === 'noteTags' && !splitNoteTagId(change.rowId)) continue;
    if (localRow && sameRow(key, localRow, row)) continue;
    candidates.set(key, [...(candidates.get(key) ?? []), row]);
  }

  const deleted = (key: SyncTableKey) => new Set(deletes.get(key) ?? []);

  // Etiquetas con el mismo nombre: gana el id menor.
  const tagMerges: PullPlan['tagMerges'] = [];
  const tagIdMap = new Map<string, string>();
  const deletedTags = deleted('tags');
  const owners = new Map<string, string>();
  for (const tag of local.tags) {
    if (!deletedTags.has(tag.id)) owners.set(tag.name.toLocaleLowerCase(), tag.id);
  }
  const tagRows: Row[] = [];
  for (const row of candidates.get('tags') ?? []) {
    const id = String(row.id);
    for (const [name, owner] of owners) if (owner === id) owners.delete(name);
    const name = String(row.name).toLocaleLowerCase();
    const owner = owners.get(name);
    if (!owner || owner === id) {
      owners.set(name, id);
      tagRows.push(row);
    } else if (id < owner) {
      tagMerges.push({ from: owner, to: id });
      owners.set(name, id);
      tagRows.push(row);
    } else {
      // Gana la local: la del servidor se funde con ella (si existía aquí, se borra y se sube
      // la lápida; si no, sus notas pasan a la local).
      tagIdMap.set(id, owner);
      if (local.ids.tags.has(id)) tagMerges.push({ from: id, to: owner });
    }
  }
  candidates.set('tags', tagRows);
  const mergedFrom = new Set(tagMerges.map((m) => m.from));
  const mapTag = (id: string) => tagIdMap.get(id) ?? tagMerges.find((m) => m.from === id)?.to ?? id;

  const known = (key: 'folders' | 'notes' | 'checklistItems' | 'tags') => {
    const ids = new Set([
      ...local.ids[key],
      ...(candidates.get(key) ?? []).map((r) => String(r.id)),
    ]);
    for (const id of deleted(key)) ids.delete(id);
    if (key === 'tags') for (const id of mergedFrom) ids.delete(id);
    return ids;
  };
  const folderIds = known('folders');
  const noteIds = known('notes');
  const itemIds = known('checklistItems');
  const tagIds = known('tags');

  const upserts: Upsert[] = [];
  const push = (key: SyncTableKey, rows: Row[], track = false) =>
    rows.forEach((row) => upserts.push({ key, row, track }));

  push(
    'folders',
    parentsFirst(
      (candidates.get('folders') ?? []).map((f) => {
        const parentId = f.parentId as string | null;
        return {
          ...f,
          id: String(f.id),
          parentId: parentId && parentId !== f.id && folderIds.has(parentId) ? parentId : null,
        };
      }),
    ),
  );
  push(
    'notes',
    (candidates.get('notes') ?? []).map((n) =>
      n.folderId && !folderIds.has(String(n.folderId)) ? { ...n, folderId: null } : n,
    ),
  );
  push(
    'checklistItems',
    (candidates.get('checklistItems') ?? []).filter((i) => noteIds.has(String(i.noteId))),
  );
  push('tags', candidates.get('tags') ?? []);
  for (const pair of candidates.get('noteTags') ?? []) {
    const tagId = mapTag(String(pair.tagId));
    if (!noteIds.has(String(pair.noteId)) || !tagIds.has(tagId)) continue;
    push('noteTags', [{ ...pair, tagId }], tagId !== pair.tagId);
  }
  push(
    'reminders',
    (candidates.get('reminders') ?? []).filter(
      (r) =>
        noteIds.has(String(r.noteId)) &&
        (!r.checklistItemId || itemIds.has(String(r.checklistItemId))),
    ),
  );
  push(
    'attachments',
    (candidates.get('attachments') ?? []).filter((a) => noteIds.has(String(a.noteId))),
  );
  for (const row of candidates.get('savedFilters') ?? []) {
    const filter = parseFilter(String(row.queryJson));
    const mapped = filter.tagIds?.map(mapTag);
    if (!mapped || mapped.every((id, i) => id === filter.tagIds?.[i])) {
      push('savedFilters', [row]);
    } else {
      const queryJson = serializeFilter({ ...filter, tagIds: [...new Set(mapped)] });
      push('savedFilters', [{ ...row, queryJson }], true);
    }
  }

  return {
    upserts,
    // Al revés que las dependencias: primero lo que apunta a otras filas.
    deletes: [...SYNC_TABLE_KEYS]
      .reverse()
      .flatMap((key) => (deletes.get(key) ?? []).map((rowId) => ({ key, rowId }))),
    dropPending,
    tagMerges,
  };
}
