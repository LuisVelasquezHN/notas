import * as LocalAuthentication from 'expo-local-authentication';
import { AuthenticationType, SecurityLevel } from 'expo-local-authentication';

import { t } from '@/i18n';

export type BiometryKind = 'face' | 'fingerprint' | 'iris' | null;

export type AuthSupport = {
  /** Hay biometría o, al menos, un código/PIN/patrón del dispositivo con el que verificar. */
  available: boolean;
  /** Biometría configurada (para el texto de la opción: "Face ID", "huella"…). */
  biometry: BiometryKind;
};

/**
 * Qué puede usar el dispositivo para desbloquear. Sin biometría, `authenticateAsync` pide el código
 * del dispositivo (iOS y Android): eso es el "PIN" de la app, sin guardar uno propio.
 */
export async function getAuthSupport(): Promise<AuthSupport> {
  try {
    const [level, enrolled, types] = await Promise.all([
      LocalAuthentication.getEnrolledLevelAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const biometry: BiometryKind = !enrolled
      ? null
      : types.includes(AuthenticationType.FACIAL_RECOGNITION)
        ? 'face'
        : types.includes(AuthenticationType.FINGERPRINT)
          ? 'fingerprint'
          : types.includes(AuthenticationType.IRIS)
            ? 'iris'
            : null;
    return { available: level !== SecurityLevel.NONE, biometry };
  } catch {
    return { available: false, biometry: null };
  }
}

let pending: Promise<boolean> | null = null;

/** Pide biometría o el código del dispositivo. Varias llamadas a la vez comparten el mismo diálogo. */
export function authenticate(reason: string): Promise<boolean> {
  pending ??= LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    cancelLabel: t('common.cancel'),
  })
    .then((result) => result.success)
    .catch(() => false)
    .finally(() => {
      pending = null;
    });
  return pending;
}

/** `true` mientras el diálogo del sistema está abierto (la app pasa a "inactive" en iOS). */
export function isAuthenticating(): boolean {
  return pending !== null;
}
