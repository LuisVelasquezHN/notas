import {
  activeCriteriaCount,
  describeFilter,
  isFilterEmpty,
  modifiedSince,
  normalizeFilter,
  parseFilter,
  serializeFilter,
  toggleValue,
} from '../filter';

const names = {
  tag: (id: string) => ({ t1: 'trabajo' })[id],
  folder: (id: string) => ({ f1: 'Casa' })[id],
};

describe('NoteFilter', () => {
  it('normaliza: quita vacíos, duplicados y valores desconocidos', () => {
    expect(
      normalizeFilter({
        search: '  hola ',
        types: ['text', 'text', 'video'],
        colors: [],
        tagIds: ['t1', 3],
        favorite: false,
        hasReminder: true,
        modifiedWithin: 'decade',
        extra: 1,
      }),
    ).toEqual({ search: 'hola', types: ['text'], tagIds: ['t1'], hasReminder: true });
  });

  it('tolera JSON inválido o ajeno', () => {
    expect(parseFilter('no es json')).toEqual({});
    expect(parseFilter('[1,2]')).toEqual({});
    expect(parseFilter(null)).toEqual({});
  });

  it('serializa y vuelve a leer el mismo filtro', () => {
    const filter = { colors: ['red' as const], favorite: true, modifiedWithin: 'week' as const };
    expect(parseFilter(serializeFilter(filter))).toEqual(filter);
  });

  it('cuenta los criterios activos', () => {
    expect(activeCriteriaCount({})).toBe(0);
    expect(activeCriteriaCount({ search: 'x', includeArchived: true })).toBe(0);
    expect(activeCriteriaCount({ colors: ['red', 'blue'], favorite: true })).toBe(2);
    expect(isFilterEmpty({ search: '  ' })).toBe(true);
    expect(isFilterEmpty({ search: 'x' })).toBe(false);
  });

  it('alterna valores de una lista', () => {
    expect(toggleValue(undefined, 'a')).toEqual(['a']);
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('calcula la fecha mínima de modificación', () => {
    const now = 10 * 86_400_000;
    expect(modifiedSince('week', now)).toBe(3 * 86_400_000);
  });

  it('desglosa el filtro en chips y permite quitar cada uno', () => {
    const filter = { colors: ['red' as const], tagIds: ['t1', 'borrada'], favorite: true };
    const parts = describeFilter(filter, names);
    expect(parts.map((p) => p.label)).toEqual(['Rojo', '#trabajo', 'Favoritas']);
    expect(normalizeFilter(parts[1].without)).toEqual({
      colors: ['red'],
      tagIds: ['borrada'],
      favorite: true,
    });
    expect(normalizeFilter(parts[0].without)).toEqual({
      tagIds: ['t1', 'borrada'],
      favorite: true,
    });
  });
});
