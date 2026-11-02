import { and, desc, eq, notInArray } from 'drizzle-orm';

import { getDb } from '@/db/client';
import { noteVersions, notes } from '@/db/schema';
import { syncInlineImages } from '@/features/attachments/repository';
import { docToText, parseDoc } from '@/features/editor/doc';
import { uuidv7 } from '@/lib/ids';

/**
 * Historial de versiones de las notas de texto. Antes de guardar un cambio, si la última versión
 * guardada es de hace más de `VERSION_INTERVAL_MS`, se guarda el contenido anterior. Así quedan
 * copias cada pocos minutos de edición, sin una por pulsación.
 *
 * Es solo local (no se sincroniza): cada dispositivo guarda el historial de lo que se editó en él,
 * dentro de la base de datos de la cuenta. Se borra con la nota.
 */

export const VERSION_INTERVAL_MS = 10 * 60_000;
export const MAX_VERSIONS = 30;

export function noteVersionsQuery(noteId: string) {
  return getDb()
    .select()
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt), desc(noteVersions.id));
}

/**
 * Guarda el contenido actual de la nota como versión si toca (o siempre, con `force`). No guarda
 * notas vacías ni una versión igual a la última.
 */
export async function snapshotNote(noteId: string, { force = false, now = Date.now() } = {}) {
  const db = getDb();
  const [note] = await db
    .select({
      title: notes.title,
      contentJson: notes.contentJson,
      contentText: notes.contentText,
      updatedAt: notes.updatedAt,
      type: notes.type,
    })
    .from(notes)
    .where(eq(notes.id, noteId));
  if (!note || note.type !== 'text') return false;
  if (!note.title.trim() && !note.contentText.trim()) return false;

  const [last] = await db
    .select()
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt), desc(noteVersions.id))
    .limit(1);
  if (last) {
    const same = last.title === note.title && last.contentJson === note.contentJson;
    if (same) return false;
    if (!force && note.updatedAt - last.createdAt < VERSION_INTERVAL_MS) return false;
  }

  // La fecha de la versión es la de ese contenido (su última edición).
  await db.insert(noteVersions).values({
    id: uuidv7(now),
    noteId,
    title: note.title,
    contentJson: note.contentJson,
    createdAt: Math.min(note.updatedAt, now),
  });
  await pruneVersions(noteId);
  return true;
}

async function pruneVersions(noteId: string) {
  const db = getDb();
  const keep = await db
    .select({ id: noteVersions.id })
    .from(noteVersions)
    .where(eq(noteVersions.noteId, noteId))
    .orderBy(desc(noteVersions.createdAt), desc(noteVersions.id))
    .limit(MAX_VERSIONS);
  await db.delete(noteVersions).where(
    and(
      eq(noteVersions.noteId, noteId),
      notInArray(
        noteVersions.id,
        keep.map((v) => v.id),
      ),
    ),
  );
}

/**
 * Vuelve a una versión. Lo que había se guarda antes como versión: restaurar también se puede
 * deshacer desde el historial.
 */
export async function restoreVersion(versionId: string) {
  const db = getDb();
  const [version] = await db.select().from(noteVersions).where(eq(noteVersions.id, versionId));
  if (!version) return null;
  await snapshotNote(version.noteId, { force: true });
  const doc = parseDoc(version.contentJson);
  const updatedAt = Date.now();
  await db
    .update(notes)
    .set({
      title: version.title,
      contentJson: version.contentJson,
      contentText: docToText(doc),
      updatedAt,
    })
    .where(eq(notes.id, version.noteId));
  await syncInlineImages(version.noteId, doc);
  return { noteId: version.noteId, updatedAt };
}
