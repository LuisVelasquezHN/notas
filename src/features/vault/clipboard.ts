import * as Clipboard from 'expo-clipboard';
import { AppState } from 'react-native';

/**
 * Copiar datos de las notas seguras. En Android se marca como sensible (no aparece en la vista
 * previa del portapapeles ni en las sugerencias del teclado) y, pasado un tiempo, se borra si
 * sigue siendo lo que se copió: no queda una contraseña olvidada en el portapapeles.
 */
export const CLIPBOARD_CLEAR_MS = 45_000;

let pending: { value: string; at: number } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

async function clearIfUnchanged() {
  if (!pending) return;
  const { value } = pending;
  pending = null;
  if (timer) clearTimeout(timer);
  timer = null;
  try {
    // Si el usuario copió otra cosa después, no se toca.
    if ((await Clipboard.getStringAsync()) === value) await Clipboard.setStringAsync('');
  } catch {
    // Sin permiso para leerlo (p. ej. el navegador sin foco): se vacía igualmente.
    await Clipboard.setStringAsync('').catch(() => undefined);
  }
}

// Con la app en segundo plano los temporizadores se detienen: al volver, si ya pasó el tiempo,
// se borra entonces.
AppState.addEventListener('change', (state) => {
  if (state === 'active' && pending && Date.now() - pending.at >= CLIPBOARD_CLEAR_MS) {
    void clearIfUnchanged();
  }
});

export async function copySecret(value: string): Promise<void> {
  await Clipboard.setStringAsync(value, { android: { isSensitive: true } });
  pending = { value, at: Date.now() };
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void clearIfUnchanged(), CLIPBOARD_CLEAR_MS);
}
