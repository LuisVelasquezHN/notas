import { getRandomValues } from 'expo-crypto';

type RandomFill = (bytes: Uint8Array) => Uint8Array;

const defaultRandom: RandomFill = (bytes) => getRandomValues(bytes);

/**
 * UUID v7 (RFC 9562): 48 bits de timestamp en ms + 74 bits aleatorios.
 * Ordenable por fecha de creación y generable sin coordinación, apto para una sincronización futura.
 */
export function uuidv7(now: number = Date.now(), random: RandomFill = defaultRandom): string {
  const bytes = random(new Uint8Array(16));

  let ts = now;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // versión 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 9562

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Extrae los milisegundos codificados en un UUID v7. */
export function uuidv7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
