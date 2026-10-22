import { usePreventScreenCapture } from 'expo-screen-capture';

/**
 * Impide capturas y grabaciones de pantalla mientras la pantalla está montada (notas seguras).
 * En Android oculta también el contenido en el selector de apps. En web no existe (ver `.web.ts`).
 */
export function usePreventCapture() {
  usePreventScreenCapture();
}
