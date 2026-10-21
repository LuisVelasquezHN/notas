import { randomFillSync } from 'node:crypto';

import { uuidv7, uuidv7Timestamp } from '../ids';

const random = (bytes: Uint8Array) => randomFillSync(bytes);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('genera un UUID v7 válido', () => {
    expect(uuidv7(Date.now(), random)).toMatch(UUID_V7);
  });

  it('codifica el timestamp en los primeros 48 bits', () => {
    const now = Date.UTC(2026, 9, 18, 12, 30);
    expect(uuidv7Timestamp(uuidv7(now, random))).toBe(now);
  });

  it('ordena lexicográficamente por fecha de creación', () => {
    const ids = [3, 1, 2].map((offset) => uuidv7(1_700_000_000_000 + offset * 1000, random));
    expect([...ids].sort()).toEqual([ids[1], ids[2], ids[0]]);
  });

  it('no repite IDs en el mismo milisegundo', () => {
    const now = Date.now();
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(now, random)));
    expect(ids.size).toBe(1000);
  });
});
