import { sortKeyAfter, sortKeyBefore, sortKeyBetween, sortKeysBetween } from '../sort-key';

describe('sort keys (fractional indexing)', () => {
  it('genera claves que respetan el orden al insertar entre vecinos', () => {
    const a = sortKeyAfter(null);
    const c = sortKeyAfter(a);
    const b = sortKeyBetween(a, c);
    expect([c, a, b].sort()).toEqual([a, b, c]);
  });

  it('permite insertar al principio indefinidamente', () => {
    let first = sortKeyAfter(null);
    for (let i = 0; i < 50; i++) {
      const next = sortKeyBefore(first);
      expect(next < first).toBe(true);
      first = next;
    }
  });

  it('genera n claves ordenadas entre dos vecinos', () => {
    const keys = sortKeysBetween(null, null, 5);
    expect(keys).toHaveLength(5);
    expect([...keys].sort()).toEqual(keys);
  });
});
