import { getTableColumns, type Table } from 'drizzle-orm';

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
  type Attachment,
  type ChecklistItem,
  type Folder,
  type Note,
  type Reminder,
  type SavedFilter,
  type SecureNote,
  type Tag,
  type Vault,
} from '@/db/schema';

/**
 * Copia de seguridad: un JSON con todas las tablas (también lo que está en la papelera) y el
 * contenido de los adjuntos en base64. Las filas usan los nombres de propiedad de Drizzle.
 */

export const BACKUP_FORMAT = 'notas-backup';
export const BACKUP_VERSION = 1;

export type NoteTag = typeof noteTags.$inferSelect;

/** El adjunto apunta a su contenido en `files` (varias filas pueden compartir fichero). */
export type BackupAttachment = Attachment & { file: string | null };

export type BackupData = {
  folders: Folder[];
  notes: Note[];
  checklistItems: ChecklistItem[];
  tags: Tag[];
  noteTags: NoteTag[];
  reminders: Reminder[];
  attachments: BackupAttachment[];
  savedFilters: SavedFilter[];
  /** Notas seguras: van cifradas tal cual (sin la contraseña maestra no se pueden leer). */
  vaults: Vault[];
  secureNotes: SecureNote[];
};

export type BackupFile = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  app: { version: string | null; platform: string };
  data: BackupData;
  files: Record<string, { mime: string | null; base64: string }>;
};

export type BackupErrorReason = 'notBackup' | 'newerVersion';

export class BackupFormatError extends Error {
  constructor(readonly reason: BackupErrorReason) {
    super(`Invalid backup: ${reason}`);
  }
}

export const BACKUP_TABLES = {
  folders,
  notes,
  checklistItems,
  tags,
  noteTags,
  reminders,
  attachments,
  savedFilters,
  vaults,
  secureNotes,
} satisfies Record<keyof BackupData, Table>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Filas válidas de una tabla: solo las columnas conocidas, con el tipo correcto. Se descartan las
 * filas a las que les falta una columna obligatoria (sin valor por defecto). Los booleanos pueden
 * llegar como 0/1.
 */
export function sanitizeRows<T>(table: Table, raw: unknown, extra: string[] = []): T[] {
  if (!Array.isArray(raw)) return [];
  const columns = Object.entries(getTableColumns(table));
  const result: T[] = [];
  for (const input of raw) {
    if (!isObject(input)) continue;
    const row: Record<string, unknown> = {};
    let valid = true;
    for (const [key, column] of columns) {
      let value = input[key];
      if (column.dataType === 'boolean' && (value === 0 || value === 1)) value = value === 1;
      if (value === undefined || value === null) {
        if (column.notNull && !column.hasDefault) valid = false;
        else if (value === null && !column.notNull) row[key] = null;
        continue;
      }
      if (typeof value !== column.dataType) {
        valid = false;
        continue;
      }
      row[key] = value;
    }
    for (const key of extra) if (key in input) row[key] = input[key];
    if (valid) result.push(row as T);
  }
  return result;
}

/** Lee y valida una copia. Lanza `BackupFormatError` si no es una copia de Notas o es más nueva. */
export function parseBackup(json: string): BackupFile {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new BackupFormatError('notBackup');
  }
  if (!isObject(value) || value.format !== BACKUP_FORMAT || !isObject(value.data)) {
    throw new BackupFormatError('notBackup');
  }
  if (typeof value.version !== 'number' || value.version > BACKUP_VERSION) {
    throw new BackupFormatError('newerVersion');
  }
  const data = value.data;
  const files: BackupFile['files'] = {};
  if (isObject(value.files)) {
    for (const [key, file] of Object.entries(value.files)) {
      if (isObject(file) && typeof file.base64 === 'string') {
        files[key] = {
          mime: typeof file.mime === 'string' ? file.mime : null,
          base64: file.base64,
        };
      }
    }
  }
  return {
    format: BACKUP_FORMAT,
    version: value.version,
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : 0,
    app: isObject(value.app)
      ? {
          version: typeof value.app.version === 'string' ? value.app.version : null,
          platform: String(value.app.platform ?? ''),
        }
      : { version: null, platform: '' },
    data: {
      folders: sanitizeRows(folders, data.folders),
      notes: sanitizeRows(notes, data.notes),
      checklistItems: sanitizeRows(checklistItems, data.checklistItems),
      tags: sanitizeRows(tags, data.tags),
      noteTags: sanitizeRows(noteTags, data.noteTags),
      reminders: sanitizeRows(reminders, data.reminders),
      attachments: sanitizeRows<BackupAttachment>(attachments, data.attachments, ['file']).map(
        (a) => ({ ...a, file: typeof a.file === 'string' ? a.file : null }),
      ),
      savedFilters: sanitizeRows(savedFilters, data.savedFilters),
      vaults: sanitizeRows(vaults, data.vaults),
      secureNotes: sanitizeRows(secureNotes, data.secureNotes),
    },
    files,
  };
}
