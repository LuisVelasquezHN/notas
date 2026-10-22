import type { AESEncryptionKey } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import Storage from 'expo-sqlite/kv-store';

import { exportKey, importKey } from './crypto';

/**
 * Desbloqueo con huella o Face ID (iOS y Android). La clave de datos se guarda en el llavero del
 * sistema (Keychain / Android Keystore), solo en este dispositivo, sin copia de seguridad y
 * exigiendo biometría para leerla. Si cambian las huellas o caras registradas, el sistema la
 * invalida y hay que volver a usar la contraseña.
 */
export const biometricUnlockAvailable = true;

const itemName = (vaultId: string) => `lvnotes.vault.${vaultId}`;
const flagName = (vaultId: string) => `vault.biometric.${vaultId}`;

const options = (prompt: string): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  authenticationPrompt: prompt,
});

export function isBiometricUnlockEnabled(vaultId: string): boolean {
  return Storage.getItemSync(flagName(vaultId)) === '1';
}

export async function enableBiometricUnlock(
  vaultId: string,
  key: AESEncryptionKey,
  prompt: string,
) {
  await SecureStore.setItemAsync(itemName(vaultId), await exportKey(key), options(prompt));
  Storage.setItemSync(flagName(vaultId), '1');
}

export async function disableBiometricUnlock(vaultId: string) {
  Storage.removeItemSync(flagName(vaultId));
  await SecureStore.deleteItemAsync(itemName(vaultId)).catch(() => undefined);
}

/** Pide la biometría y devuelve la clave, o `null` si se cancela o ya no es válida. */
export async function unlockWithBiometrics(
  vaultId: string,
  prompt: string,
): Promise<AESEncryptionKey | null> {
  try {
    const value = await SecureStore.getItemAsync(itemName(vaultId), options(prompt));
    return value ? await importKey(value) : null;
  } catch (e) {
    console.warn('Bóveda: no se pudo leer la clave del llavero', e);
    return null;
  }
}
