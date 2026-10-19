import { Platform, type TextInputKeyPressEvent } from 'react-native';

/**
 * En web, `submitBehavior` no evita el salto de línea en un `TextInput` multilínea.
 * Si la tecla es Intro (sin Mayús), cancela el salto y devuelve `true` para tratarla como envío.
 * En iOS y Android devuelve siempre `false`: allí lo resuelve `submitBehavior`.
 */
export function consumeWebEnter(e: TextInputKeyPressEvent): boolean {
  if (Platform.OS !== 'web') return false;
  const native = e.nativeEvent as { key: string; shiftKey?: boolean };
  if (native.key !== 'Enter' || native.shiftKey) return false;
  e.preventDefault();
  return true;
}
