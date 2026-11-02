import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

import type { Attachment, AttachmentPlacement } from '@/db/schema';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { showSnackbar, showUndo } from '@/stores/snackbar-store';

import { downscaleForInline } from './downscale';
import { addAttachments, removeAttachment, restoreAttachment } from './repository';

/** Calidad JPEG de las fotos: suficiente para notas y bastante más ligera que el original. */
const PHOTO_QUALITY = 0.8;

export type ImageSource = 'camera' | 'library';

/**
 * Pide una o varias imágenes (cámara o galería) y las adjunta a la nota: arriba (portada) o dentro
 * del texto. Devuelve las filas creadas (para insertar en el texto las `inline`).
 * Debe llamarse directamente desde un toque (en web el selector lo exige).
 */
export async function pickImages(
  noteId: string,
  source: ImageSource,
  placement: AttachmentPlacement = 'cover',
): Promise<Attachment[]> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await permissionDenied('camera', permission.canAskAgain);
      return [];
    }
  }
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    quality: PHOTO_QUALITY,
    allowsMultipleSelection: source === 'library',
    selectionLimit: 10,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.length) return [];

  try {
    const images = await Promise.all(
      result.assets.map(async (asset) => {
        const image = {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          mime: asset.mimeType ?? 'image/jpeg',
        };
        return placement === 'inline' ? downscaleForInline(image) : image;
      }),
    );
    return await addAttachments(
      noteId,
      images.map((image) => ({ kind: 'image' as const, ...image, placement })),
    );
  } catch (e) {
    console.warn('Adjuntos: no se pudo guardar la imagen', e);
    showSnackbar(t('attachments.imageSaveFailed'));
    return [];
  }
}

/** Imágenes pegadas o arrastradas al editor (data URI): se añaden dentro del texto. */
export async function addInlineImages(
  noteId: string,
  images: { dataUri: string; width: number; height: number }[],
): Promise<Attachment[]> {
  try {
    return await addAttachments(
      noteId,
      images.map((image) => ({
        kind: 'image' as const,
        uri: image.dataUri,
        mime: /^data:([^;,]+)/.exec(image.dataUri)?.[1] ?? 'image/jpeg',
        width: image.width,
        height: image.height,
        placement: 'inline' as const,
      })),
    );
  } catch (e) {
    console.warn('Adjuntos: no se pudo guardar la imagen', e);
    showSnackbar(t('attachments.imageSaveFailed'));
    return [];
  }
}

export async function deleteAttachment(attachment: Attachment) {
  await removeAttachment(attachment.id);
  showUndo(
    attachment.kind === 'audio' ? t('attachments.audioDeleted') : t('attachments.imageDeleted'),
    () => restoreAttachment(attachment.id),
  );
}

/** Permiso denegado: si ya no se puede volver a pedir, se ofrece abrir los ajustes del sistema. */
export async function permissionDenied(what: 'camera' | 'microphone', canAskAgain: boolean) {
  if (canAskAgain || Platform.OS === 'web') {
    showSnackbar(t(`permissions.${what}.denied`));
    return;
  }
  const open = await confirm({
    title: t(`permissions.${what}.title`),
    message: t(`permissions.${what}.message`),
    confirmLabel: t('common.openSettings'),
  });
  if (open) await Linking.openSettings();
}
