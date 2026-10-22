import { scryptAsync } from '@noble/hashes/scrypt.js';
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  getRandomBytes,
} from 'expo-crypto';

/**
 * Criptografía de las notas seguras (PLAN.md §10). No se implementa ningún algoritmo aquí:
 * - AES-256-GCM (cifrado autenticado) de expo-crypto: nativo en iOS/Android, WebCrypto en web;
 * - scrypt de `@noble/hashes` (auditada, JS puro: da el mismo resultado en todas partes).
 *
 * Esquema: cada bóveda tiene una clave aleatoria de 256 bits (la "clave de datos") con la que se
 * cifran sus notas. Esa clave se guarda envuelta (cifrada) con otra derivada de la contraseña
 * maestra con scrypt y una sal aleatoria. Cambiar la contraseña solo vuelve a envolver la clave.
 * Cada texto cifrado lleva como datos asociados (AAD) a qué pertenece: no se puede mover el de
 * una nota a otra ni hacerlo pasar por la clave de la bóveda.
 */

export type KdfParams = { alg: 'scrypt'; N: number; r: number; p: number; salt: string };

/** OWASP (Password Storage Cheat Sheet): scrypt N=2^16, r=8, p=2 (64 MiB). */
export const DEFAULT_KDF = { N: 2 ** 16, r: 8, p: 2 } as const;

/** Contraseña maestra mínima: frases largas mejor que contraseñas cortas y raras. */
export const MIN_PASSWORD_LENGTH = 10;

// --- Codificación (sin depender de TextEncoder/TextDecoder ni Buffer) --------------------------

export function utf8Encode(text: string): Uint8Array {
  const out: number[] = [];
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) out.push(code);
    else if (code < 0x800) out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) {
      out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      out.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return Uint8Array.from(out);
}

/** UTF-8 a texto. Las secuencias no válidas se sustituyen por U+FFFD (no lanza). */
export function utf8Decode(bytes: Uint8Array): string {
  let out = '';
  const cont = (i: number) => (i < bytes.length && (bytes[i] & 0xc0) === 0x80 ? bytes[i] & 63 : -1);
  for (let i = 0; i < bytes.length;) {
    const b = bytes[i++];
    const extra =
      b < 0x80
        ? 0
        : b >= 0xc2 && b < 0xe0
          ? 1
          : b >= 0xe0 && b < 0xf0
            ? 2
            : b >= 0xf0 && b < 0xf5
              ? 3
              : -1;
    if (extra < 0) {
      out += '\uFFFD';
      continue;
    }
    let code = extra === 0 ? b : b & (0x3f >> extra);
    let valid = true;
    for (let k = 0; k < extra; k++) {
      const c = cont(i);
      if (c < 0) {
        valid = false;
        break;
      }
      code = (code << 6) | c;
      i++;
    }
    out +=
      valid && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code)
        : '\uFFFD';
  }
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// --- Claves ------------------------------------------------------------------------------------

const vaultAad = (vaultId: string) => utf8Encode(`lv-notes:vault-key:${vaultId}`);
const noteAad = (noteId: string) => utf8Encode(`lv-notes:secure-note:${noteId}`);

/** Clave derivada de la contraseña (solo sirve para envolver la clave de datos). */
async function deriveWrappingKey(password: string, kdf: KdfParams): Promise<AESEncryptionKey> {
  const bytes = await scryptAsync(utf8Encode(password.normalize('NFKC')), fromBase64(kdf.salt), {
    N: kdf.N,
    r: kdf.r,
    p: kdf.p,
    dkLen: 32,
    // Cede el hilo cada poco: la interfaz sigue respondiendo mientras se calcula.
    asyncTick: 16,
  });
  return AESEncryptionKey.import(bytes);
}

async function wrap(dataKey: AESEncryptionKey, password: string, vaultId: string) {
  const kdf: KdfParams = { alg: 'scrypt', ...DEFAULT_KDF, salt: toBase64(getRandomBytes(16)) };
  const wrappingKey = await deriveWrappingKey(password, kdf);
  const sealed = await aesEncryptAsync(await dataKey.bytes(), wrappingKey, {
    additionalData: vaultAad(vaultId),
  });
  return { kdf: JSON.stringify(kdf), wrappedKey: toBase64(await sealed.combined('bytes')) };
}

/** Crea la clave de datos de una bóveda nueva y la envuelve con la contraseña. */
export async function createVaultKey(password: string, vaultId: string) {
  const dataKey = await AESEncryptionKey.generate();
  return { dataKey, ...(await wrap(dataKey, password, vaultId)) };
}

/** Vuelve a envolver la clave de datos con otra contraseña (las notas no cambian). */
export function rewrapVaultKey(dataKey: AESEncryptionKey, password: string, vaultId: string) {
  return wrap(dataKey, password, vaultId);
}

export function parseKdf(json: string): KdfParams | null {
  try {
    const value = JSON.parse(json) as Partial<KdfParams>;
    const ok =
      value.alg === 'scrypt' &&
      typeof value.salt === 'string' &&
      [value.N, value.r, value.p].every((n) => typeof n === 'number' && n > 0 && n <= 2 ** 20);
    return ok ? (value as KdfParams) : null;
  } catch {
    return null;
  }
}

/** Abre la clave de datos con la contraseña. `null` si la contraseña no es la correcta. */
export async function unwrapVaultKey(
  password: string,
  vault: { id: string; kdf: string; wrappedKey: string },
): Promise<AESEncryptionKey | null> {
  const kdf = parseKdf(vault.kdf);
  if (!kdf) return null;
  try {
    const wrappingKey = await deriveWrappingKey(password, kdf);
    const bytes = await aesDecryptAsync(
      AESSealedData.fromCombined(fromBase64(vault.wrappedKey)),
      wrappingKey,
      { additionalData: vaultAad(vault.id) },
    );
    return await AESEncryptionKey.import(bytes);
  } catch {
    // GCM no autentica: contraseña incorrecta (o datos alterados).
    return null;
  }
}

export async function exportKey(key: AESEncryptionKey): Promise<string> {
  return toBase64(await key.bytes());
}

export async function importKey(base64: string): Promise<AESEncryptionKey> {
  return AESEncryptionKey.import(fromBase64(base64));
}

// --- Notas -------------------------------------------------------------------------------------

export async function encryptNote<T>(key: AESEncryptionKey, noteId: string, value: T) {
  const sealed = await aesEncryptAsync(utf8Encode(JSON.stringify(value)), key, {
    additionalData: noteAad(noteId),
  });
  return toBase64(await sealed.combined('bytes'));
}

/** Descifra una nota. Lanza si la clave no es la suya o si el texto cifrado se ha alterado. */
export async function decryptNote<T>(key: AESEncryptionKey, noteId: string, payload: string) {
  const bytes = await aesDecryptAsync(AESSealedData.fromCombined(fromBase64(payload)), key, {
    additionalData: noteAad(noteId),
  });
  return JSON.parse(utf8Decode(bytes)) as T;
}
