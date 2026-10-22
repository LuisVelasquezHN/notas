import type { Table } from 'drizzle-orm';

import {
  attachments,
  checklistItems,
  folders,
  noteTags,
  notes,
  reminders,
  savedFilters,
  secureNotes,
  tags,
  vaults,
} from '@/db/schema';

/**
 * Tablas que se sincronizan, en orden de dependencias (cada una solo apunta a las anteriores).
 * `name` es el nombre en SQLite y en el servidor (`sync_rows.tbl`). Los datos viajan con los
 * nombres de propiedad de Drizzle, igual que en las copias de seguridad.
 */
export const SYNC_TABLES = {
  folders: { table: folders, name: 'folders' },
  notes: { table: notes, name: 'notes' },
  checklistItems: { table: checklistItems, name: 'checklist_items' },
  tags: { table: tags, name: 'tags' },
  noteTags: { table: noteTags, name: 'note_tags' },
  reminders: { table: reminders, name: 'reminders' },
  attachments: { table: attachments, name: 'attachments' },
  savedFilters: { table: savedFilters, name: 'saved_filters' },
  // Notas seguras: viajan cifradas (el servidor no puede leerlas, ver PLAN.md §10).
  vaults: { table: vaults, name: 'vaults' },
  secureNotes: { table: secureNotes, name: 'secure_notes' },
} satisfies Record<string, { table: Table; name: string }>;

export type SyncTableKey = keyof typeof SYNC_TABLES;
export type SyncTableName = (typeof SYNC_TABLES)[SyncTableKey]['name'];

export const SYNC_TABLE_KEYS = Object.keys(SYNC_TABLES) as SyncTableKey[];

const KEY_BY_NAME = new Map(SYNC_TABLE_KEYS.map((key) => [SYNC_TABLES[key].name, key]));

export function tableKeyFromName(name: string): SyncTableKey | undefined {
  return KEY_BY_NAME.get(name as SyncTableName);
}

/**
 * Columnas que solo tienen sentido en este dispositivo: no se suben y, al bajar una fila, se
 * conserva el valor local (la ruta del fichero de un adjunto se rellena al descargarlo).
 */
export const LOCAL_ONLY_COLUMNS: Partial<Record<SyncTableKey, string[]>> = {
  reminders: ['osNotificationId'],
  attachments: ['localUri'],
};

/** Id de un par nota–etiqueta (la tabla no tiene columna `id`). */
export const noteTagId = (noteId: string, tagId: string) => `${noteId}|${tagId}`;

export function splitNoteTagId(id: string): { noteId: string; tagId: string } | null {
  const [noteId, tagId, ...rest] = id.split('|');
  return noteId && tagId && rest.length === 0 ? { noteId, tagId } : null;
}
