import { fileExtension } from '@/features/attachments/mime';
import { readFileBase64, storeBase64 } from '@/features/attachments/storage';

import { ATTACHMENTS_BUCKET, getSupabase } from './supabase';

/** Ficheros de los adjuntos en Supabase Storage: `<user_id>/<attachment_id>`. */

const path = (userId: string, attachmentId: string) => `${userId}/${attachmentId}`;

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('FileReader'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

const statusOf = (error: unknown) => {
  const e = error as { status?: number; statusCode?: string };
  return Number(e.statusCode ?? e.status);
};

/**
 * Sube el fichero de un adjunto (si ya está subido, no hace nada: el contenido de un adjunto
 * no cambia). Si el fichero local se perdió, se avisa y se sigue: los demás dispositivos no
 * podrán descargarlo y lo ignorarán.
 */
export async function uploadAttachment(
  userId: string,
  attachment: { id: string; localUri: string; mime: string | null },
): Promise<void> {
  let base64: string;
  try {
    base64 = await readFileBase64(attachment.localUri);
  } catch (e) {
    console.warn('Sync: no se pudo leer un adjunto', e);
    return;
  }
  const { error } = await getSupabase()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(path(userId, attachment.id), base64ToBytes(base64), {
      contentType: attachment.mime ?? 'application/octet-stream',
      upsert: false,
    });
  if (!error || statusOf(error) === 409 || /exists|duplicate/i.test(error.message)) return;
  // Rechazado por el servidor (tipo o tamaño no permitidos): no se reintenta para no bloquear la
  // sincronización; los demás dispositivos no lo tendrán.
  if ([400, 413, 415].includes(statusOf(error))) {
    console.warn('Sync: el servidor rechazó un adjunto', error.message);
    return;
  }
  throw error;
}

/**
 * Descarga el fichero de un adjunto y lo guarda en el almacén local. Devuelve la ruta local, o
 * `null` si el fichero no está en el servidor.
 */
export async function downloadAttachment(
  userId: string,
  attachment: { id: string; mime: string | null },
): Promise<string | null> {
  const { data, error } = await getSupabase()
    .storage.from(ATTACHMENTS_BUCKET)
    .download(path(userId, attachment.id));
  if (error) {
    if (statusOf(error) === 404 || statusOf(error) === 400 || /not.?found/i.test(error.message)) {
      return null;
    }
    throw error;
  }
  const name = `${attachment.id}.${fileExtension(attachment.mime, '')}`;
  const stored = await storeBase64(name, await blobToBase64(data), attachment.mime);
  return stored.localUri;
}

/** Borra todos los ficheros de la cuenta (al eliminarla). */
export async function deleteAllAttachments(userId: string): Promise<void> {
  const bucket = getSupabase().storage.from(ATTACHMENTS_BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    if (data.length === 0) return;
    const { error: removeError } = await bucket.remove(data.map((f) => path(userId, f.name)));
    if (removeError) throw removeError;
  }
}
