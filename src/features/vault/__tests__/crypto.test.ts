import {
  createVaultKey,
  decryptNote,
  encryptNote,
  fromBase64,
  parseKdf,
  rewrapVaultKey,
  toBase64,
  unwrapVaultKey,
  utf8Decode,
  utf8Encode,
} from '../crypto';

// AES-GCM de verdad: la implementación web de expo-crypto (WebCrypto, presente en Node).
jest.mock('../../../../node_modules/expo-crypto/build/aes/ExpoCryptoAES', () =>
  jest.requireActual('../../../../node_modules/expo-crypto/build/aes/ExpoCryptoAES.web'),
);

jest.setTimeout(30_000);

describe('codificación', () => {
  it('UTF-8 y base64 de ida y vuelta (acentos, emojis)', () => {
    const text = 'Contraseña: ñandú 🔐 — 中文';
    expect(utf8Decode(utf8Encode(text))).toBe(text);
    expect(Array.from(utf8Encode('é'))).toEqual([0xc3, 0xa9]);
    const bytes = Uint8Array.from([0, 1, 254, 255, 128]);
    expect(Array.from(fromBase64(toBase64(bytes)))).toEqual(Array.from(bytes));
  });
});

describe('bóveda', () => {
  it('abre la clave solo con la contraseña correcta', async () => {
    const vault = { id: 'v1', ...(await createVaultKey('una frase bastante larga', 'v1')) };
    expect(parseKdf(vault.kdf)).toMatchObject({ alg: 'scrypt', N: 65536, r: 8, p: 2 });
    expect(await unwrapVaultKey('otra contraseña distinta', vault)).toBeNull();
    const key = await unwrapVaultKey('una frase bastante larga', vault);
    expect(key).not.toBeNull();
    expect(Array.from(await key!.bytes())).toEqual(Array.from(await vault.dataKey.bytes()));
  });

  it('la clave envuelta no se puede usar con otro id de bóveda', async () => {
    const vault = { id: 'v1', ...(await createVaultKey('una frase bastante larga', 'v1')) };
    expect(await unwrapVaultKey('una frase bastante larga', { ...vault, id: 'v2' })).toBeNull();
  });

  it('cambiar la contraseña conserva la clave de datos', async () => {
    const { dataKey } = await createVaultKey('contraseña antigua 1', 'v1');
    const rewrapped = { id: 'v1', ...(await rewrapVaultKey(dataKey, 'contraseña nueva 22', 'v1')) };
    const key = await unwrapVaultKey('contraseña nueva 22', rewrapped);
    expect(Array.from(await key!.bytes())).toEqual(Array.from(await dataKey.bytes()));
  });
});

describe('notas', () => {
  it('cifra y descifra; el texto cifrado no contiene el original', async () => {
    const { dataKey } = await createVaultKey('una frase bastante larga', 'v1');
    const note = { title: 'AWS root', doc: { type: 'doc', content: [] }, secret: 'hunter2' };
    const payload = await encryptNote(dataKey, 'n1', note);
    expect(payload).not.toContain('hunter2');
    expect(utf8Decode(fromBase64(payload))).not.toContain('AWS');
    expect(await decryptNote(dataKey, 'n1', payload)).toEqual(note);
    // Dos cifrados del mismo contenido son distintos (IV aleatorio).
    expect(await encryptNote(dataKey, 'n1', note)).not.toBe(payload);
  });

  it('detecta alteraciones, otra clave y texto movido a otra nota', async () => {
    const { dataKey } = await createVaultKey('una frase bastante larga', 'v1');
    const other = (await createVaultKey('otra frase bastante larga', 'v2')).dataKey;
    const payload = await encryptNote(dataKey, 'n1', { title: 'x' });
    const bytes = fromBase64(payload);
    bytes[bytes.length - 1] ^= 1;
    await expect(decryptNote(dataKey, 'n1', toBase64(bytes))).rejects.toThrow();
    await expect(decryptNote(other, 'n1', payload)).rejects.toThrow();
    await expect(decryptNote(dataKey, 'n2', payload)).rejects.toThrow();
  });
});
