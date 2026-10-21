import { neighborKeys, splitPinned } from '../reorder';

const n = (sortKey: string, isPinned = false) => ({ sortKey, isPinned });

describe('reorder', () => {
  it('toma las claves de las vecinas en el orden nuevo', () => {
    const ordered = [n('a0'), n('a2'), n('a1')];
    expect(neighborKeys(ordered, 1)).toEqual({ before: 'a0', after: 'a1' });
  });

  it('usa null en los extremos', () => {
    const ordered = [n('a1'), n('a0'), n('a2')];
    expect(neighborKeys(ordered, 0)).toEqual({ before: null, after: 'a0' });
    expect(neighborKeys(ordered, 2)).toEqual({ before: 'a0', after: null });
    expect(neighborKeys([n('a0')], 0)).toEqual({ before: null, after: null });
  });

  it('separa ancladas y no ancladas conservando el orden', () => {
    const { pinned, others } = splitPinned([n('a', true), n('b'), n('c', true), n('d')]);
    expect(pinned.map((x) => x.sortKey)).toEqual(['a', 'c']);
    expect(others.map((x) => x.sortKey)).toEqual(['b', 'd']);
  });
});
