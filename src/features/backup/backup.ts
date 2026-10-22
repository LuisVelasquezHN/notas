import { eq, sql, type Table } from 'drizzle-orm';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { getDb } from '@/db/client';
import { fileExtension } from '@/features/attachments/mime';
import { readFileBase64, storeBase64 } from '@/features/attachments/storage';

import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  type BackupAttachment,
  type BackupData,
  type BackupFile,
} from './format';
import { planImport, type ImportPlan, type LocalIndex } from './plan';

/** Clave del contenido de un adjunto en `files`: la ruta relativa en nativo, el id en web. */
const fileKey = (a: { id: string; localUri: string }) =>
  a.localUri.startsWith('data:') ? `id:${a.id}` : a.localUri;

/** Reúne todas las tablas y el contenido de los adjuntos. */
export async function buildBackup(now: number = Date.now()): Promise<BackupFile> {
  const db = getDb();
  const [
    folders,
    notes,
    checklistItems,
    tags,
    noteTags,
    reminders,
    attachmentRows,
    savedFilters,
    vaults,
    secureNotes,
  ] = await Promise.all([
    db.select().from(BACKUP_TABLES.folders),
    db.select().from(BACKUP_TABLES.notes),
    db.select().from(BACKUP_TABLES.checklistItems),
    db.select().from(BACKUP_TABLES.tags),
    db.select().from(BACKUP_TABLES.noteTags),
    db.select().from(BACKUP_TABLES.reminders),
    db.select().from(BACKUP_TABLES.attachments),
    db.select().from(BACKUP_TABLES.savedFilters),
    db.select().from(BACKUP_TABLES.vaults),
    db.select().from(BACKUP_TABLES.secureNotes),
  ]);

  const files: BackupFile['files'] = {};
  const attachments: BackupAttachment[] = [];
  for (const row of attachmentRows) {
    const key = fileKey(row);
    if (!(key in files)) {
      try {
        files[key] = { mime: row.mime, base64: await readFileBase64(row.localUri) };
      } catch (e) {
        // Fichero perdido: el adjunto se exporta sin contenido y no se importará.
        console.warn('Copia: no se pudo leer un adjunto', e);
      }
    }
    attachments.push({ ...row, file: key in files ? key : null });
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    app: { version: Constants.expoConfig?.version ?? null, platform: Platform.OS },
    data: {
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
    },
    files,
  };
}

/** "notas-backup-2026-10-20.json" (fecha local). */
export function backupFileName(now: number = Date.now()): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `notas-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

async function stamps(table: Table & { id: unknown; updatedAt: unknown }) {
  const rows = (await getDb()
    .select({ id: sql<string>`id`, updatedAt: sql<number>`updated_at` })
    .from(table)) as { id: string; updatedAt: number }[];
  return new Map(rows.map((r) => [r.id, Number(r.updatedAt)]));
}

async function localIndex(): Promise<LocalIndex> {
  const db = getDb();
  const t = BACKUP_TABLES;
  const [
    folders,
    notes,
    checklistItems,
    tags,
    reminders,
    attachments,
    savedFilters,
    vaults,
    secureNotes,
  ] = await Promise.all([
    stamps(t.folders),
    stamps(t.notes),
    stamps(t.checklistItems),
    stamps(t.tags),
    stamps(t.reminders),
    stamps(t.attachments),
    stamps(t.savedFilters),
    stamps(t.vaults),
    stamps(t.secureNotes),
  ]);
  const tagNames = await db.select({ id: t.tags.id, name: t.tags.name }).from(t.tags);
  const pairs = await db.select().from(t.noteTags);
  return {
    stamps: {
      folders,
      notes,
      checklistItems,
      tags,
      reminders,
      attachments,
      savedFilters,
      vaults,
      secureNotes,
    },
    tagNames,
    noteTagKeys: new Set(pairs.map((p) => `${p.noteId}|${p.tagId}`)),
  };
}

export type ImportSummary = { notesAdded: number; notesUpdated: number; total: number };

/**
 * Escribe los ficheros de los adjuntos que se van a importar y devuelve las filas con su nueva
 * ruta. Un mismo fichero de la copia se escribe una sola vez.
 */
async function storeAttachmentFiles(
  rows: BackupAttachment[],
  files: BackupFile['files'],
): Promise<BackupAttachment[]> {
  const written = new Map<string, string>();
  const result: BackupAttachment[] = [];
  for (const row of rows) {
    const file = row.file ? files[row.file] : undefined;
    if (!row.file || !file) continue;
    let localUri = written.get(row.file);
    if (!localUri) {
      const mime = row.mime ?? file.mime;
      const name = `${row.id}.${fileExtension(mime, row.localUri.startsWith('data:') ? '' : row.localUri)}`;
      localUri = (await storeBase64(name, file.base64, mime)).localUri;
      written.set(row.file, localUri);
    }
    result.push({ ...row, localUri });
  }
  return result;
}

const withoutFile = ({ file: _file, ...row }: BackupAttachment) => row;

/** Aplica el plan en una transacción, en orden de dependencias. */
function apply(plan: ImportPlan) {
  const t = BACKUP_TABLES;
  getDb().transaction((tx) => {
    const run = <K extends Exclude<keyof BackupData, 'noteTags'>>(
      key: K,
      rows: { insert: object[]; update: object[] },
    ) => {
      const table = t[key] as typeof t.notes;
      for (const row of rows.insert)
        tx.insert(table)
          .values(row as never)
          .run();
      for (const row of rows.update) {
        tx.update(table)
          .set(row as never)
          .where(eq(table.id, (row as { id: string }).id))
          .run();
      }
    };
    run('folders', plan.folders);
    run('notes', plan.notes);
    run('checklistItems', plan.checklistItems);
    run('tags', plan.tags);
    for (const pair of plan.noteTags.insert) tx.insert(t.noteTags).values(pair).run();
    run('reminders', plan.reminders);
    run('attachments', {
      insert: plan.attachments.insert.map(withoutFile),
      update: plan.attachments.update.map(withoutFile),
    });
    run('savedFilters', plan.savedFilters);
    run('vaults', plan.vaults);
    run('secureNotes', plan.secureNotes);
  });
}

/** Fusiona una copia con los datos actuales (ver `planImport`). */
export async function importBackup(backup: BackupFile): Promise<ImportSummary> {
  const plan = planImport(backup.data, await localIndex());
  plan.attachments = {
    insert: await storeAttachmentFiles(plan.attachments.insert, backup.files),
    update: await storeAttachmentFiles(plan.attachments.update, backup.files),
  };
  apply(plan);
  return {
    notesAdded: plan.notes.insert.length,
    notesUpdated: plan.notes.update.length,
    total: backup.data.notes.length,
  };
}

/** ¿Hay notas bloqueadas? (exportar la copia saca su contenido de la app). */
export async function hasLockedNotes(): Promise<boolean> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(BACKUP_TABLES.notes)
    .where(eq(BACKUP_TABLES.notes.isLocked, true));
  return Number(row?.count ?? 0) > 0;
}
