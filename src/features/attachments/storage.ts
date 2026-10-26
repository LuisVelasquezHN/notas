import { Directory, File, Paths } from 'expo-file-system';

import { activeScope, attachmentsDirName } from '@/db/scope';

/**
 * Ficheros de los adjuntos (iOS y Android). Se guardan en `Documents/attachments/` (cada cuenta en
 * su subcarpeta, ver `db/scope.ts`) y en la base de datos solo se guarda la ruta **relativa**
 * (`attachments/<cuenta>/<id>.<ext>`): en iOS la ruta absoluta del contenedor cambia entre
 * instalaciones y actualizaciones.
 */

/** Carpeta del ámbito activo (la base de datos abierta). */
const dirName = () => attachmentsDirName(activeScope());

function directory() {
  const dir = new Directory(Paths.document, dirName());
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export type StoredFile = { localUri: string; size: number | null };

/** Copia (o mueve, si es temporal) un fichero recién capturado al almacén de adjuntos. */
export async function storeFile(
  sourceUri: string,
  name: string,
  { move = false }: { move?: boolean; mime?: string | null } = {},
): Promise<StoredFile> {
  const source = new File(sourceUri);
  const target = new File(directory(), name);
  if (move) source.move(target);
  else source.copy(target);
  return { localUri: `${dirName()}/${name}`, size: target.size || null };
}

/** Contenido de un adjunto en base64 (copias de seguridad, imágenes del PDF). */
export async function readFileBase64(localUri: string): Promise<string> {
  return new File(resolveUri(localUri)).base64();
}

/** Guarda en el almacén un fichero que llega en base64 (al importar una copia). */
export async function storeBase64(
  name: string,
  base64: string,
  _mime: string | null,
): Promise<StoredFile> {
  const target = new File(directory(), name);
  if (target.exists) target.delete();
  target.create();
  target.write(base64, { encoding: 'base64' });
  return { localUri: `${dirName()}/${name}`, size: target.size || null };
}

/** URI que entienden `expo-image` y `expo-audio`. */
export function resolveUri(localUri: string): string {
  if (/^[a-z]+:/i.test(localUri)) return localUri;
  return new File(Paths.document, localUri).uri;
}

/**
 * Borra los ficheros del almacén que ya no referencia ningún adjunto (borrados definitivos,
 * capturas canceladas…). Varias filas pueden compartir fichero (duplicar una nota no lo copia).
 */
export function deleteUnreferencedFiles(referenced: Set<string>): number {
  const name = dirName();
  const dir = new Directory(Paths.document, name);
  if (!dir.exists) return 0;
  let deleted = 0;
  // Solo ficheros: las subcarpetas de la carpeta de invitado son las de las cuentas.
  for (const entry of dir.list()) {
    if (entry instanceof File && !referenced.has(`${name}/${entry.name}`)) {
      entry.delete();
      deleted++;
    }
  }
  return deleted;
}
