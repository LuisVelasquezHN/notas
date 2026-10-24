import { getRandomBytes } from 'expo-crypto';

/**
 * Generador de contraseñas. Usa el generador aleatorio criptográfico del sistema (expo-crypto) y
 * muestreo por rechazo para que todos los caracteres sean igual de probables (con `% n` a secas
 * algunos saldrían más). Garantiza al menos un carácter de cada grupo elegido.
 */

export const PASSWORD_SETS = {
  lower: 'abcdefghijkmnopqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!#$%&*+-=?@^_~',
} as const;

export type PasswordOptions = {
  length: number;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
};

export const DEFAULT_PASSWORD: PasswordOptions = {
  length: 20,
  upper: true,
  digits: true,
  symbols: true,
};

export const PASSWORD_LENGTH = { min: 8, max: 64 } as const;

/** Bytes aleatorios (inyectable en los tests). */
export type RandomSource = (count: number) => Uint8Array;

/** Entero uniforme en [0, n) con muestreo por rechazo (n ≤ 256). */
function uniform(n: number, random: RandomSource): number {
  const limit = 256 - (256 % n);
  for (;;) {
    for (const byte of random(16)) if (byte < limit) return byte % n;
  }
}

export function generatePassword(
  options: PasswordOptions,
  random: RandomSource = getRandomBytes,
): string {
  const length = Math.min(PASSWORD_LENGTH.max, Math.max(PASSWORD_LENGTH.min, options.length));
  const sets: string[] = [PASSWORD_SETS.lower];
  if (options.upper) sets.push(PASSWORD_SETS.upper);
  if (options.digits) sets.push(PASSWORD_SETS.digits);
  if (options.symbols) sets.push(PASSWORD_SETS.symbols);
  const all = sets.join('');
  const pick = (chars: string) => chars[uniform(chars.length, random)];

  const chars = sets.map(pick);
  while (chars.length < length) chars.push(pick(all));
  // Fisher–Yates: los caracteres obligatorios no quedan siempre al principio.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = uniform(i + 1, random);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
