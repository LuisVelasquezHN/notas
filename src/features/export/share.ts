import { Directory, File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

/**
 * Compartir ficheros generados (iOS y Android): se escriben en `cache/export/` y se abre la hoja
 * del sistema (guardar en Archivos, Drive, enviar por correo…).
 */

export type TextFile = {
  name: string;
  mime: string;
  /** Tipo de iOS (p. ej. `net.daringfireball.markdown`), para que las apps lo reconozcan. */
  uti?: string;
  content: string;
};

function exportDirectory() {
  const dir = new Directory(Paths.cache, 'export');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

function freshFile(name: string) {
  const file = new File(exportDirectory(), name);
  if (file.exists) file.delete();
  return file;
}

export async function shareTextFile({ name, mime, uti, content }: TextFile, dialogTitle?: string) {
  const file = freshFile(name);
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: mime, UTI: uti, dialogTitle });
}

/** Genera el PDF desde HTML (expo-print) y lo comparte con el nombre indicado. */
export async function sharePdf(html: string, name: string, dialogTitle?: string) {
  const { uri } = await Print.printToFileAsync({ html });
  const file = freshFile(name);
  new File(uri).move(file);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle,
  });
}

/** Comparte el texto directamente (mensajería, correo…), sin fichero. */
export async function shareText(text: string, title?: string) {
  await Share.share({ message: text, title });
}

export const canShareText = true;
