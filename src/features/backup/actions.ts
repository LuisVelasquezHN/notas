import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { shareTextFile } from '@/features/export/share';
import { authenticate } from '@/features/security/auth';
import { currentLocale, t } from '@/i18n';
import { capabilities } from '@/lib/capabilities';
import { confirm } from '@/lib/confirm';
import { showSnackbar } from '@/stores/snackbar-store';

import { backupFileName, buildBackup, hasLockedNotes, importBackup } from './backup';
import { BackupFormatError, parseBackup } from './format';

/**
 * Exporta la copia completa (JSON). En iOS y Android se abre la hoja de compartir para guardarla
 * en Archivos, Drive…; en web se descarga. Con notas bloqueadas se pide verificación antes.
 */
export async function exportBackup() {
  if (capabilities.biometrics && (await hasLockedNotes())) {
    if (!(await authenticate(t('backup.exportReason')))) return;
  }
  try {
    const backup = await buildBackup();
    await shareTextFile(
      {
        name: backupFileName(),
        mime: 'application/json',
        uti: 'public.json',
        content: JSON.stringify(backup),
      },
      t('backup.export'),
    );
    if (Platform.OS === 'web') showSnackbar(t('backup.downloaded'));
  } catch (e) {
    console.warn('Copia: error al exportar', e);
    showSnackbar(t('backup.exportFailed'));
  }
}

async function readPicked(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (asset.file) return asset.file.text();
  if (Platform.OS === 'web') return (await fetch(asset.uri)).text();
  return new File(asset.uri).text();
}

/** Elige un fichero de copia, pide confirmación y lo fusiona con los datos actuales. */
export async function importBackupFromFile() {
  const picked = await DocumentPicker.getDocumentAsync({
    // Muchos gestores de ficheros de Android no marcan los .json como tales: se valida al leer.
    type: Platform.OS === 'web' ? ['application/json', '.json'] : '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets[0]) return;

  let backup;
  try {
    backup = parseBackup(await readPicked(picked.assets[0]));
  } catch (e) {
    const reason = e instanceof BackupFormatError ? e.reason : 'notBackup';
    showSnackbar(t(`backup.errors.${reason}`));
    return;
  }

  const date = backup.exportedAt
    ? new Date(backup.exportedAt).toLocaleDateString(currentLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';
  const ok = await confirm({
    title: t('backup.confirmTitle'),
    message: t('backup.confirmMessage', { count: backup.data.notes.length, date }),
    confirmLabel: t('backup.importAction'),
  });
  if (!ok) return;

  try {
    const summary = await importBackup(backup);
    showSnackbar(
      summary.notesAdded + summary.notesUpdated === 0
        ? t('backup.nothingNew')
        : t('backup.imported', { added: summary.notesAdded, updated: summary.notesUpdated }),
    );
  } catch (e) {
    console.warn('Copia: error al importar', e);
    showSnackbar(t('backup.importFailed'));
  }
}
