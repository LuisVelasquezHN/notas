import { drizzle } from 'drizzle-orm/better-sqlite3';

import * as schema from '@/db/schema';
import type { EditorDoc } from '@/features/editor/doc';
import { sqliteClient } from '@/test/sqlite';

/** La bóveda contra SQLite real y AES-GCM real (WebCrypto): en la base de datos solo hay cifrado. */
jest.mock('../../../../node_modules/expo-crypto/build/aes/ExpoCryptoAES', () =>
  jest.requireActual('../../../../node_modules/expo-crypto/build/aes/ExpoCryptoAES.web'),
);
// scrypt más ligero: aquí se prueba la lógica de la bóveda; los parámetros reales los cubre
// crypto.test.ts (con los de verdad esta prueba tarda mucho y puede pasarse de tiempo).
jest.mock('@noble/hashes/scrypt.js', () => {
  const actual = jest.requireActual('@noble/hashes/scrypt.js');
  return {
    scryptAsync: (password: Uint8Array, salt: Uint8Array, opts: { N: number }) =>
      actual.scryptAsync(password, salt, { ...opts, N: 2 ** 10 }),
  };
});
jest.mock('better-sqlite3', () => ({}), { virtual: true });
jest.mock('@/db/client', () => ({ getDb: () => mockDb }));
jest.mock('../biometrics', () => ({ disableBiometricUnlock: async () => {} }));

let mockDb: ReturnType<typeof drizzle<typeof schema>>;
let client: ReturnType<typeof sqliteClient>;

// eslint-disable-next-line import/first
import {
  changeVaultPassword,
  createVault,
  decryptAllSecureNotes,
  resetVault,
  saveSecureNote,
  unlockVault,
} from '../repository';
// eslint-disable-next-line import/first
import { useVaultStore } from '../store';

jest.setTimeout(60_000);

const doc = (text: string): EditorDoc => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

beforeEach(() => {
  client = sqliteClient();
  mockDb = drizzle(client as never, { schema });
  useVaultStore.getState().lock();
});

const dump = () =>
  JSON.stringify([
    client.sqlite.prepare('SELECT * FROM vaults').all(),
    client.sqlite.prepare('SELECT * FROM secure_notes').all(),
  ]);

it('guarda solo texto cifrado y se abre con la contraseña', async () => {
  await createVault('frase de prueba larga');
  await saveSecureNote(null, { title: 'AWS root', doc: doc('clave: Hunter2-Prueba') });

  expect(dump()).not.toMatch(/AWS|Hunter2|frase de prueba/);

  useVaultStore.getState().lock();
  expect(await unlockVault('otra contraseña cualquiera')).toBe(false);
  expect(useVaultStore.getState().keys).toBeNull();
  expect(await unlockVault('frase de prueba larga')).toBe(true);
  const [note] = await decryptAllSecureNotes();
  expect(note.content).toEqual({ title: 'AWS root', doc: doc('clave: Hunter2-Prueba') });
});

it('cambiar la contraseña: la nueva abre, la antigua no, las notas siguen igual', async () => {
  await createVault('contraseña antigua 1');
  await saveSecureNote(null, { title: 'x', doc: doc('secreto') });
  const before = client.sqlite.prepare('SELECT payload FROM secure_notes').get();
  await changeVaultPassword('contraseña nueva 22');
  expect(client.sqlite.prepare('SELECT payload FROM secure_notes').get()).toEqual(before);

  useVaultStore.getState().lock();
  expect(await unlockVault('contraseña antigua 1')).toBe(false);
  expect(await unlockVault('contraseña nueva 22')).toBe(true);
  expect((await decryptAllSecureNotes())[0].content?.title).toBe('x');
});

it('dos bóvedas con la misma contraseña (creadas sin conexión) se funden en una', async () => {
  await createVault('frase de prueba larga');
  await saveSecureNote(null, { title: 'del primero', doc: doc('a') });
  await createVault('frase de prueba larga');
  await saveSecureNote(null, { title: 'del segundo', doc: doc('b') });
  expect(client.sqlite.prepare('SELECT count(*) AS n FROM vaults').get()).toEqual({ n: 2 });

  useVaultStore.getState().lock();
  expect(await unlockVault('frase de prueba larga')).toBe(true);
  expect(client.sqlite.prepare('SELECT count(*) AS n FROM vaults').get()).toEqual({ n: 1 });
  const titles = (await decryptAllSecureNotes()).map((n) => n.content?.title).sort();
  expect(titles).toEqual(['del primero', 'del segundo']);
});

it('borrar la bóveda elimina todo y la bloquea', async () => {
  await createVault('frase de prueba larga');
  await saveSecureNote(null, { title: 'x', doc: doc('y') });
  await resetVault();
  expect(dump()).toBe('[[],[]]');
  expect(useVaultStore.getState().keys).toBeNull();
});
