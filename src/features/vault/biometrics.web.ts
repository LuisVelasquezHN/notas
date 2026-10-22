import type { AESEncryptionKey } from 'expo-crypto';

/** En web no hay llavero con biometría: la bóveda se abre siempre con la contraseña. */
export const biometricUnlockAvailable = false;

export function isBiometricUnlockEnabled(_vaultId: string): boolean {
  return false;
}

export async function enableBiometricUnlock(
  _vaultId: string,
  _key: AESEncryptionKey,
  _prompt: string,
): Promise<void> {}

export async function disableBiometricUnlock(_vaultId: string): Promise<void> {}

export async function unlockWithBiometrics(
  _vaultId: string,
  _prompt: string,
): Promise<AESEncryptionKey | null> {
  return null;
}
