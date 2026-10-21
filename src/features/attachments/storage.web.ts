/**
 * Adjuntos en web: no hay sistema de ficheros, así que el contenido se guarda en la propia base de
 * datos como data URI. Las imágenes se reducen antes (lado mayor ≤ 1600 px, JPEG) para no llenar
 * SQLite/OPFS. Limitación documentada en PLAN.md §3.1.
 */

const MAX_IMAGE_SIDE = 1600;
const JPEG_QUALITY = 0.82;

export type StoredFile = { localUri: string; size: number | null };

export async function storeFile(
  sourceUri: string,
  _name: string,
  { mime }: { move?: boolean; mime?: string | null } = {},
): Promise<StoredFile> {
  const isImage = (mime ?? '').startsWith('image/') || sourceUri.startsWith('data:image/');
  const dataUri = isImage ? await downscaleImage(sourceUri) : await toDataUri(sourceUri);
  return { localUri: dataUri, size: Math.round((dataUri.length * 3) / 4) };
}

/** El contenido ya es un data URI: se devuelve la parte en base64. */
export async function readFileBase64(localUri: string): Promise<string> {
  const dataUri = await toDataUri(localUri);
  return dataUri.slice(dataUri.indexOf(',') + 1);
}

export async function storeBase64(
  _name: string,
  base64: string,
  mime: string | null,
): Promise<StoredFile> {
  return {
    localUri: `data:${mime ?? 'application/octet-stream'};base64,${base64}`,
    size: Math.round((base64.length * 3) / 4),
  };
}

export function resolveUri(localUri: string): string {
  return localUri;
}

export function deleteUnreferencedFiles(_referenced: Set<string>): number {
  // Sin ficheros: al borrar la fila se borra el contenido.
  return 0;
}

async function toDataUri(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}

async function downscaleImage(uri: string): Promise<string> {
  const image = new Image();
  image.src = uri;
  await image.decode();
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  // Imágenes pequeñas (o formatos que el canvas no reduciría bien, como GIF): tal cual.
  if (scale === 1 && uri.startsWith('data:')) return uri;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}
