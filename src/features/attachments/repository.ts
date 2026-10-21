import { and, asc, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { attachments, notes, type Attachment, type AttachmentKind } from '@/db/schema';
import { DAY_MS } from '@/lib/dates';
import { uuidv7 } from '@/lib/ids';
import { sortKeyAfter } from '@/lib/sort-key';

import { fileExtension } from './mime';
import { deleteUnreferencedFiles, storeFile } from './storage';

/** Adjuntos visibles de una nota, en su orden. */
export function noteAttachmentsQuery(noteId: string) {
  return getDb()
    .select()
    .from(attachments)
    .where(and(eq(attachments.noteId, noteId), isNull(attachments.deletedAt)))
    .orderBy(asc(attachments.sortKey));
}

/** Primera imagen de cada nota (miniatura de la tarjeta): una fila por nota. */
export function firstImagesQuery() {
  return getDb()
    .select({
      noteId: attachments.noteId,
      localUri: attachments.localUri,
      width: attachments.width,
      height: attachments.height,
    })
    .from(attachments)
    .where(
      eq(
        attachments.id,
        sql`(SELECT b.id FROM attachments b WHERE b.note_id = ${attachments.noteId}
             AND b.kind = 'image' AND b.deleted_at IS NULL ORDER BY b.sort_key LIMIT 1)`,
      ),
    );
}

/** Número de adjuntos por nota y tipo (indicadores de la tarjeta). */
export function attachmentCountsQuery() {
  return getDb()
    .select({
      noteId: attachments.noteId,
      kind: attachments.kind,
      count: sql<number>`count(*)`,
    })
    .from(attachments)
    .where(isNull(attachments.deletedAt))
    .groupBy(attachments.noteId, attachments.kind);
}

export type AttachmentCounts = Partial<Record<AttachmentKind, number>>;

async function lastSortKey(noteId: string): Promise<string | null> {
  const [last] = await getDb()
    .select({ sortKey: attachments.sortKey })
    .from(attachments)
    .where(eq(attachments.noteId, noteId))
    .orderBy(sql`${attachments.sortKey} DESC`)
    .limit(1);
  return last?.sortKey ?? null;
}

export type NewAttachmentInput = {
  kind: AttachmentKind;
  uri: string;
  mime?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  /** El fichero de origen es temporal (grabación): se mueve en vez de copiarse. */
  temporary?: boolean;
};

/** Guarda los ficheros y añade los adjuntos al final de la nota. */
export async function addAttachments(noteId: string, inputs: NewAttachmentInput[]) {
  if (inputs.length === 0) return [];
  const db = getDb();
  let sortKey = await lastSortKey(noteId);
  const rows: Attachment[] = [];
  for (const input of inputs) {
    const now = Date.now();
    const id = uuidv7(now);
    const stored = await storeFile(input.uri, `${id}.${fileExtension(input.mime, input.uri)}`, {
      move: input.temporary,
      mime: input.mime,
    });
    sortKey = sortKeyAfter(sortKey);
    rows.push({
      id,
      noteId,
      kind: input.kind,
      localUri: stored.localUri,
      mime: input.mime ?? null,
      size: stored.size,
      width: input.width || null,
      height: input.height || null,
      durationMs: input.durationMs ?? null,
      sortKey,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }
  const now = Date.now();
  db.transaction((tx) => {
    tx.insert(attachments).values(rows).run();
    // Añadir un adjunto es editar la nota.
    tx.update(notes).set({ updatedAt: now }).where(eq(notes.id, noteId)).run();
  });
  return rows;
}

/** Borrado lógico (se puede deshacer); el fichero se borra al purgar. */
export async function removeAttachment(id: string) {
  const now = Date.now();
  await getDb()
    .update(attachments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(attachments.id, id));
}

export async function restoreAttachment(id: string) {
  await getDb()
    .update(attachments)
    .set({ deletedAt: null, updatedAt: Date.now() })
    .where(eq(attachments.id, id));
}

/** Copia las filas de adjuntos de una nota a otra (duplicar). Comparten fichero. */
export async function copyAttachments(fromNoteId: string, toNoteId: string, now = Date.now()) {
  const rows = await noteAttachmentsQuery(fromNoteId);
  if (rows.length === 0) return;
  await getDb()
    .insert(attachments)
    .values(
      rows.map((row) => ({
        ...row,
        id: uuidv7(now),
        noteId: toNoteId,
        createdAt: now,
        updatedAt: now,
      })),
    );
}

/** ¿La nota tiene algún adjunto visible? (Una nota nueva con solo una foto no está vacía.) */
export async function hasAttachments(noteId: string) {
  const [row] = await getDb()
    .select({ id: attachments.id })
    .from(attachments)
    .where(and(eq(attachments.noteId, noteId), isNull(attachments.deletedAt)))
    .limit(1);
  return row !== undefined;
}

/**
 * Al arrancar: elimina los adjuntos quitados hace más de un día (ya no se pueden deshacer) y los
 * ficheros que no referencia ninguna fila (p. ej. de notas borradas definitivamente).
 */
export async function purgeAttachments(now: number = Date.now()) {
  const db = getDb();
  await db
    .delete(attachments)
    .where(and(isNotNull(attachments.deletedAt), lt(attachments.deletedAt, now - DAY_MS)));
  const rows = await db.select({ localUri: attachments.localUri }).from(attachments);
  return deleteUnreferencedFiles(new Set(rows.map((r) => r.localUri)));
}

/** Tras un borrado definitivo: libera los ficheros que ya no usa nadie, sin esperar al arranque. */
export async function cleanupAfterDelete() {
  const rows = await getDb().select({ localUri: attachments.localUri }).from(attachments);
  deleteUnreferencedFiles(new Set(rows.map((r) => r.localUri)));
}
