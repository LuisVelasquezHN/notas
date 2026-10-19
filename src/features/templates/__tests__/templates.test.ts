import { docToText, parseDoc, serializeDoc } from '@/features/editor/doc';

import { TEMPLATES, findTemplate, longDate } from '../templates';

const NOW = new Date(2026, 9, 19, 10, 30);

describe('plantillas', () => {
  it('tienen ids únicos', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(TEMPLATES.map((t) => [t.id, t] as const))(
    '%s produce contenido válido',
    (_id, template) => {
      const content = template.build(NOW);
      if (content.type === 'text') {
        // Sobrevive a guardar y leer, y tiene texto para la vista previa y la búsqueda.
        expect(parseDoc(serializeDoc(content.doc))).toEqual(content.doc);
        expect(docToText(content.doc).trim()).not.toBe('');
      } else {
        expect(content.items.length).toBeGreaterThan(0);
        expect(content.items.every((item) => item.trim() !== '')).toBe(true);
      }
    },
  );

  it('el diario se titula con la fecha del día', () => {
    const content = findTemplate('journal')!.build(NOW);
    expect(content.title).toBe(longDate(NOW));
    expect(content.title).toMatch(/^Lunes, 19 de octubre de 2026$/);
  });

  it('las secciones salen como líneas del texto plano', () => {
    const content = findTemplate('recipe')!.build(NOW);
    if (content.type !== 'text') throw new Error('se esperaba una nota de texto');
    expect(docToText(content.doc).split('\n')).toEqual(['Ingredientes', '', 'Pasos', '']);
  });

  it('findTemplate devuelve undefined si no existe', () => {
    expect(findTemplate('nope')).toBeUndefined();
  });
});
