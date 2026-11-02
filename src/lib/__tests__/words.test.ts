import { countWords } from '../words';

describe('countWords', () => {
  it('cuenta palabras con acentos, números y apóstrofos', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('  ')).toBe(0);
    expect(countWords('Hola, mundo')).toBe(2);
    expect(countWords('Contraseña del router: 1234 — ¡ojo!')).toBe(5);
    expect(countWords("it's a well-known fact")).toBe(4);
    expect(countWords('línea 1\nlínea 2')).toBe(4);
  });
});
