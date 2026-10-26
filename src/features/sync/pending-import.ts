import { importBackup } from '@/features/backup/backup';
import type { BackupFile } from '@/features/backup/format';

/**
 * Datos que pasan de una base de datos local a otra (ver `account-scope.ts`): se sacan como copia
 * de seguridad en memoria de la que está abierta y se importan en la siguiente que se abra.
 */
let pendingImport: BackupFile | null = null;

export function setPendingImport(backup: BackupFile) {
  pendingImport = backup;
}

/** Lo llama `AppBootstrap` al abrir una base de datos, después de las migraciones. */
export async function applyPendingImport(): Promise<void> {
  const backup = pendingImport;
  pendingImport = null;
  if (backup) await importBackup(backup);
}
