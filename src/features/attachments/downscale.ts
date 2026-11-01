import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Lado mayor de las imágenes del texto (como en web, ver `storage.web.ts`). */
const MAX_SIDE = 1600;
const QUALITY = 0.82;

export type ImageFile = { uri: string; width: number; height: number; mime: string };

/**
 * Reduce una imagen para meterla en el texto: el editor vive en una webview y recibe las
 * imágenes en base64, así que no conviene pasarle fotos de varios megas.
 */
export async function downscaleForInline(image: ImageFile): Promise<ImageFile> {
  if (Math.max(image.width, image.height) <= MAX_SIDE) return image;
  const landscape = image.width >= image.height;
  const rendered = await ImageManipulator.manipulate(image.uri)
    .resize(landscape ? { width: MAX_SIDE } : { height: MAX_SIDE })
    .renderAsync();
  const saved = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height, mime: 'image/jpeg' };
}
