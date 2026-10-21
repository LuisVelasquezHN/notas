import * as ImagePicker from 'expo-image-picker';
import { Linking, Platform } from 'react-native';

import type { Attachment } from '@/db/schema';
import { t } from '@/i18n';
import { confirm } from '@/lib/confirm';
import { showSnackbar, showUndo } from '@/stores/snackbar-store';

import { addAttachments, removeAttachment, restoreAttachment } from './repository';

/** Calidad JPEG de las fotos: suficiente para notas y bastante más ligera que el original. */
const PHOTO_QUALITY = 0.8;

export type ImageSource = 'camera' | 'library';

/**
 * Pide una o varias imágenes (cámara o galería) y las adjunta a la nota.
 * Debe llamarse directamente desde un toque (en web el selector lo exige).
 */
export async function pickImages(noteId: string, source: ImageSource) {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      await permissionDenied('camera', permission.canAskAgain);
      return 0;
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
  if (result.canceled || !result.assets?.length) return 0;

  try {
    const rows = await addAttachments(
      noteId,
      result.assets.map((asset) => ({
        kind: 'image' as const,
        uri: asset.uri,
        mime: asset.mimeType ?? 'image/jpeg',
        width: asset.width,
        height: asset.height,
      })),
    );
    return rows.length;
  } catch (e) {
    console.warn('Adjuntos: no se pudo guardar la imagen', e);
    showSnackbar(t('attachments.imageSaveFailed'));
    return 0;
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
