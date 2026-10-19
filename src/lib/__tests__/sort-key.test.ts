import {
  sortKeyAfter,
  sortKeyBefore,
  sortKeyBetween,
  sortKeyForMove,
  sortKeysBetween,
} from '../sort-key';

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

  it('mueve entre vecinos y a los extremos', () => {
    const [a, b] = sortKeysBetween(null, null, 2);
    const middle = sortKeyForMove(a, b);
    expect(a < middle && middle < b).toBe(true);
    expect(sortKeyForMove(null, a) < a).toBe(true);
    expect(sortKeyForMove(b, null) > b).toBe(true);
  });

  it('no falla con vecinos repetidos o desordenados', () => {
    const [a, b] = sortKeysBetween(null, null, 2);
    expect(sortKeyForMove(a, a) < a).toBe(true);
    expect(sortKeyForMove(b, a) < a).toBe(true);
  });
});
