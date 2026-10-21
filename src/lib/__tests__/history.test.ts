import { HISTORY_LIMIT, createHistory, pushHistory, redoHistory, undoHistory } from '../history';

describe('history', () => {
  it('deshace y rehace', () => {
    let h = createHistory('a');
    h = pushHistory(h, 'b', 0);
    h = pushHistory(h, 'c', 5000);
    expect(h.present).toBe('c');
    h = undoHistory(h);
    expect(h.present).toBe('b');
    h = undoHistory(h);
    expect(h.present).toBe('a');
    expect(undoHistory(h)).toBe(h);
    h = redoHistory(redoHistory(h));
    expect(h.present).toBe('c');
    expect(redoHistory(h)).toBe(h);
  });

  it('agrupa los cambios rápidos en un solo paso', () => {
    let h = createHistory('');
    h = pushHistory(h, 'h', 1000);
    h = pushHistory(h, 'ho', 1200);
    h = pushHistory(h, 'hol', 1400);
    expect(h.past).toEqual(['']);
    h = pushHistory(h, 'hola', 5000);
    expect(h.past).toEqual(['', 'hol']);
  });

  it('corta los grupos largos aunque no haya pausas', () => {
    let h = createHistory('');
    for (let t = 0; t <= 4000; t += 200) h = pushHistory(h, `v${t}`, t);
    expect(h.past.length).toBe(2);
  });

  it('un cambio nuevo descarta el futuro', () => {
    let h = pushHistory(pushHistory(createHistory(1), 2, 0), 3, 5000);
    h = undoHistory(h);
    h = pushHistory(h, 4, 10000);
    expect(h.future).toEqual([]);
    expect(h.past).toEqual([1, 2]);
  });

  it('ignora valores iguales y limita el tamaño', () => {
    const h0 = createHistory('x');
    expect(pushHistory(h0, 'x')).toBe(h0);
    let h = createHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = pushHistory(h, i, i * 10_000);
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});
