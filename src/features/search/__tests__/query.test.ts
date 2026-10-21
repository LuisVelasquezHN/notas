import { buildFtsMatch, likePattern, searchTerms } from '../query';

describe('search query', () => {
  it('separa palabras y quita comillas y asteriscos', () => {
    expect(searchTerms('  receta  "tarta" de*  ')).toEqual(['receta', 'tarta', 'de']);
  });

  it('construye una expresión MATCH segura con prefijos', () => {
    expect(buildFtsMatch('rec choco')).toBe('"rec"* "choco"*');
    expect(buildFtsMatch('OR AND - NOT')).toBe('"OR"* "AND"* "-"* "NOT"*');
    expect(buildFtsMatch('   ')).toBeNull();
  });

  it('escapa los comodines de LIKE', () => {
    expect(likePattern('50%_a\\b')).toBe('%50\\%\\_a\\\\b%');
  });
});
