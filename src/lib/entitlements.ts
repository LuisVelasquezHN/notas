/**
 * Capa de "derechos" (features de pago). Hoy la app es gratuita y todo devuelve `true`.
 * Si en el futuro hay un plan Pro, se conecta aquí (p. ej. RevenueCat) sin tocar las pantallas.
 */
export const FEATURES = [
  'unlimitedNotes',
  'noteLock',
  'attachments',
  'recurringReminders',
  'export',
  'cloudSync',
] as const;

export type Feature = (typeof FEATURES)[number];

export function hasEntitlement(_feature: Feature): boolean {
  return true;
}

export function useEntitlement(feature: Feature): boolean {
  return hasEntitlement(feature);
}
