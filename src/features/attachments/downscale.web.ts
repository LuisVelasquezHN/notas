export type ImageFile = { uri: string; width: number; height: number; mime: string };

/** En web, `storeFile` ya reduce las imágenes al guardarlas (`storage.web.ts`). */
export async function downscaleForInline(image: ImageFile): Promise<ImageFile> {
  return image;
}
