import { Alert, Platform } from 'react-native';

import type { Note } from '@/db/schema';
import { setLocked } from '@/features/notes/repository';
import { t } from '@/i18n';
import { capabilities } from '@/lib/capabilities';
import { useSecurityStore } from '@/stores/security-store';
import { showSnackbar, showUndo } from '@/stores/snackbar-store';

import { authenticate, getAuthSupport } from './auth';

/** Aviso cuando el dispositivo no tiene código ni biometría (no hay con qué bloquear). */
function explainNoAuth() {
  const title = t('lock.unavailableTitle');
  const message = t('lock.unavailableMessage');
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
}

/** Comprueba que se puede bloquear y verifica al usuario (para activar el bloqueo de la app). */
export async function confirmIdentity(reason: string): Promise<boolean> {
  if (!capabilities.biometrics) return false;
  if (!(await getAuthSupport()).available) {
    explainNoAuth();
    return false;
  }
  return authenticate(reason);
}

const isUnlocked = (id: string) => useSecurityStore.getState().unlockedNoteIds.includes(id);

/**
 * Desbloquea una nota para esta sesión (biometría o código). `true` si ya se puede ver su contenido.
 * Se vuelve a bloquear al salir de la app.
 */
export async function unlockNote(note: Pick<Note, 'id' | 'isLocked'>): Promise<boolean> {
  if (!note.isLocked || isUnlocked(note.id)) return true;
  const ok = await authenticate(t('lock.unlockNoteReason'));
  if (ok) useSecurityStore.getState().unlockNote(note.id);
  return ok;
}

/** Bloquea las notas, o quita el bloqueo (pide verificación si alguna sigue bloqueada). */
export async function toggleLock(notes: Note[]) {
  const ids = notes.map((n) => n.id);
  const lock = !notes.every((n) => n.isLocked);

  if (lock) {
    if (capabilities.biometrics && !(await getAuthSupport()).available) {
      explainNoAuth();
      return;
    }
    await setLocked(ids, true);
    // Quien la bloquea la está viendo: sigue abierta hasta salir de la app.
    for (const id of ids) useSecurityStore.getState().unlockNote(id);
    showUndo(t('lock.locked', { count: ids.length }), () => setLocked(ids, false));
    return;
  }

  if (notes.some((n) => n.isLocked && !isUnlocked(n.id))) {
    if (!(await authenticate(t('lock.removeLockReason')))) return;
  }
  await setLocked(ids, false);
  showSnackbar(t('lock.unlocked', { count: ids.length }));
}
