/**
 * Web: no hay biometría ni código del dispositivo (PLAN.md §3.1). El bloqueo de la app no se ofrece
 * y una nota bloqueada (p. ej. importada de una copia) se abre con un toque: solo oculta el
 * contenido a la vista, no lo protege.
 */

export type BiometryKind = 'face' | 'fingerprint' | 'iris' | null;

export type AuthSupport = { available: boolean; biometry: BiometryKind };

export async function getAuthSupport(): Promise<AuthSupport> {
  return { available: false, biometry: null };
}

export async function authenticate(_reason: string): Promise<boolean> {
  return true;
}

export function isAuthenticating(): boolean {
  return false;
}
