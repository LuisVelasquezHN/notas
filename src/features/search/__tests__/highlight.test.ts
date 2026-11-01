import { foldText, highlightSegments, matchSnippet } from '../highlight';
import { withRecent } from '../recent-store';

describe('highlightSegments', () => {
  it('marca las coincidencias sin distinguir mayúsculas ni tildes', () => {
    expect(highlightSegments('Una Canción nueva', ['cancion'])).toEqual([
      { text: 'Una ', match: false },
      { text: 'Canción', match: true },
      { text: ' nueva', match: false },
    ]);
  });

  it('marca cada aparición de varias palabras (y prefijos)', () => {
    const segments = highlightSegments('receta de pan y pan dulce', ['rec', 'pan']);
    expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual(['rec', 'pan', 'pan']);
    expect(segments.map((s) => s.text).join('')).toBe('receta de pan y pan dulce');
  });

  it('sin palabras o sin coincidencias, un solo trozo normal', () => {
    expect(highlightSegments('hola', [])).toEqual([{ text: 'hola', match: false }]);
    expect(highlightSegments('hola', ['adiós'])).toEqual([{ text: 'hola', match: false }]);
    expect(highlightSegments('', ['x'])).toEqual([]);
  });

  it('mantiene la longitud al plegar el texto', () => {
    const text = 'ÁÉÍÓÚ ñ ß İ 🙂';
    expect(foldText(text)).toHaveLength(text.length);
  });
});

describe('matchSnippet', () => {
  it('devuelve el texto entero si la coincidencia está al principio', () => {
    expect(matchSnippet('pan casero', ['pan'])).toBe('pan casero');
  });

  it('empieza cerca de una coincidencia lejana, en un límite de palabra', () => {
    const text = `${'palabra '.repeat(30)}objetivo final`;
    const snippet = matchSnippet(text, ['objetivo'], 20);
    expect(snippet.startsWith('…')).toBe(true);
    expect(snippet).toContain('objetivo final');
    expect(snippet.length).toBeLessThan(45);
    expect(snippet.slice(1).startsWith('palabra')).toBe(true);
  });
});

describe('withRecent', () => {
  it('pone la última primero, sin repetidas y con un máximo', () => {
    expect(withRecent(['pan', 'Leche'], '  leche ')).toEqual(['leche', 'pan']);
    expect(withRecent(['a1', 'a2'], 'x')).toEqual(['a1', 'a2']);
    expect(withRecent(['b', 'c', 'd'], 'aa', 3)).toEqual(['aa', 'b', 'c']);
  });
});
