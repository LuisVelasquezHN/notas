import { asc, desc, eq, isNull } from 'drizzle-orm';
import type { AESEncryptionKey } from 'expo-crypto';

import { getDb } from '@/db/client';
import { secureNotes, vaults, type SecureNote } from '@/db/schema';
import type { EditorDoc } from '@/features/editor/doc';
import { uuidv7 } from '@/lib/ids';
import { sortKeyAfter } from '@/lib/sort-key';

import { disableBiometricUnlock } from './biometrics';
import { createVaultKey, decryptNote, encryptNote, rewrapVaultKey, unwrapVaultKey } from './crypto';
import { useVaultStore } from './store';

/** Lo que va cifrado en cada nota segura (título incluido). */
export type SecureNoteContent = { title: string; doc: EditorDoc };

export type DecryptedSecureNote = {
  id: string;
  updatedAt: number;
  /** `null`: no se pudo descifrar (otra contraseña o datos dañados). */
  content: SecureNoteContent | null;
};

export const vaultsQuery = () =>
  getDb().select().from(vaults).where(isNull(vaults.deletedAt)).orderBy(asc(vaults.id));

export const secureNotesQuery = () =>
  getDb()
    .select()
    .from(secureNotes)
    .where(isNull(secureNotes.deletedAt))
    .orderBy(desc(secureNotes.updatedAt));

export const secureNoteQuery = (id: string) =>
  getDb().select().from(secureNotes).where(eq(secureNotes.id, id));

function unlocked() {
  const { keys, primaryId } = useVaultStore.getState();
  if (!keys || !primaryId || !keys[primaryId]) throw new Error('La bóveda está bloqueada');
  return { keys, primaryId, primaryKey: keys[primaryId] };
}

/** Crea la bóveda (si no hay ninguna) y la deja desbloqueada. */
export async function createVault(password: string): Promise<void> {
  const id = uuidv7();
  const { dataKey, kdf, wrappedKey } = await createVaultKey(password, id);
  const now = Date.now();
  await getDb().insert(vaults).values({ id, kdf, wrappedKey, createdAt: now, updatedAt: now });
  useVaultStore.getState().setUnlocked({ [id]: dataKey }, id);
}

/**
 * Desbloquea con la contraseña. Prueba todas las bóvedas (normalmente una; dos si se crearon sin
 * conexión en dos dispositivos): las que abre pasan a memoria y, si son varias, se funden en la
 * de id menor. Devuelve `false` si la contraseña no abre ninguna.
 */
export async function unlockVault(password: string): Promise<boolean> {
  const rows = await vaultsQuery();
  const keys: Record<string, AESEncryptionKey> = {};
  for (const row of rows) {
    const key = await unwrapVaultKey(password, row);
    if (key) keys[row.id] = key;
  }
  const ids = Object.keys(keys).sort();
  if (ids.length === 0) return false;
  useVaultStore.getState().setUnlocked(keys, ids[0]);
  await mergeVaults().catch((e: unknown) => console.warn('Bóveda: error al fundir', e));
  return true;
}

/** Deja desbloqueada la bóveda con una clave ya abierta (biometría). */
export function unlockWithKey(vaultId: string, key: AESEncryptionKey) {
  useVaultStore.getState().setUnlocked({ [vaultId]: key }, vaultId);
}

/**
 * Pasa las notas de las demás bóvedas abiertas a la principal (descifrar y volver a cifrar) y
 * borra esas bóvedas. Si alguna nota no se puede descifrar, esa bóveda se deja como está.
 */
async function mergeVaults() {
  const { keys, primaryId, primaryKey } = unlocked();
  for (const [vaultId, key] of Object.entries(keys)) {
    if (vaultId === primaryId) continue;
    const rows = await getDb().select().from(secureNotes).where(eq(secureNotes.vaultId, vaultId));
    const moved: { id: string; payload: string }[] = [];
    try {
      for (const row of rows) {
        const content = await decryptNote<SecureNoteContent>(key, row.id, row.payload);
        moved.push({ id: row.id, payload: await encryptNote(primaryKey, row.id, content) });
      }
    } catch {
      continue;
    }
    const now = Date.now();
    getDb().transaction((tx) => {
      for (const m of moved) {
        tx.update(secureNotes)
          .set({ vaultId: primaryId, payload: m.payload, updatedAt: now })
          .where(eq(secureNotes.id, m.id))
          .run();
      }
      tx.delete(vaults).where(eq(vaults.id, vaultId)).run();
    });
    await disableBiometricUnlock(vaultId);
  }
  useVaultStore.getState().setUnlocked({ [primaryId]: primaryKey }, primaryId);
}

export async function decryptSecureNote(row: SecureNote): Promise<DecryptedSecureNote> {
  const key = useVaultStore.getState().keys?.[row.vaultId];
  let content: SecureNoteContent | null = null;
  if (key) {
    try {
      content = await decryptNote<SecureNoteContent>(key, row.id, row.payload);
    } catch (e) {
      console.warn('Bóveda: no se pudo descifrar una nota', e);
    }
  }
  return { id: row.id, updatedAt: row.updatedAt, content };
}

/** Guarda (cifrada) una nota segura. Sin `id` la crea; devuelve su id. */
export async function saveSecureNote(id: string | null, content: SecureNoteContent) {
  const { primaryId, primaryKey } = unlocked();
  const now = Date.now();
  const noteId = id ?? uuidv7(now);
  const payload = await encryptNote(primaryKey, noteId, content);
  const db = getDb();
  if (id) {
    await db
      .update(secureNotes)
      .set({ payload, vaultId: primaryId, updatedAt: now })
      .where(eq(secureNotes.id, id));
  } else {
    const [last] = await db
      .select({ sortKey: secureNotes.sortKey })
      .from(secureNotes)
      .orderBy(desc(secureNotes.sortKey))
      .limit(1);
    await db.insert(secureNotes).values({
      id: noteId,
      vaultId: primaryId,
      payload,
      sortKey: sortKeyAfter(last?.sortKey ?? null),
      createdAt: now,
      updatedAt: now,
    });
  }
  return noteId;
}

/** Borra del todo una nota segura (también en los demás dispositivos). */
export async function deleteSecureNote(id: string) {
  await getDb().delete(secureNotes).where(eq(secureNotes.id, id));
}

/** Cambia la contraseña: vuelve a envolver la clave de datos (las notas no cambian). */
export async function changeVaultPassword(password: string) {
  const { primaryId, primaryKey } = unlocked();
  const { kdf, wrappedKey } = await rewrapVaultKey(primaryKey, password, primaryId);
  await getDb()
    .update(vaults)
    .set({ kdf, wrappedKey, updatedAt: Date.now() })
    .where(eq(vaults.id, primaryId));
}

/** Borra la bóveda y todas sus notas (contraseña olvidada). No se puede deshacer. */
export async function resetVault() {
  const rows = await getDb().select({ id: vaults.id }).from(vaults);
  getDb().transaction((tx) => {
    tx.delete(secureNotes).run();
    tx.delete(vaults).run();
  });
  for (const row of rows) await disableBiometricUnlock(row.id);
  useVaultStore.getState().lock();
}

/** Todas las notas descifradas (para exportarlas). */
export async function decryptAllSecureNotes(): Promise<DecryptedSecureNote[]> {
  const rows = await secureNotesQuery();
  return Promise.all(rows.map(decryptSecureNote));
}
