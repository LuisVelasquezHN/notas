import {
  docToText,
  inlineImageIds,
  linkedNoteIds,
  parseDoc,
  remapInlineImages,
  serializeDoc,
  textToDoc,
} from '../doc';

describe('doc', () => {
  it.each(['', 'hola', 'línea 1\nlínea 2', '\n\nhueco\n\n', 'fin\n'])(
    'docToText(textToDoc(%j)) devuelve el mismo texto',
    (text) => {
      expect(docToText(textToDoc(text))).toBe(text);
    },
  );

  it('genera párrafos de TipTap', () => {
    expect(textToDoc('a\n\nb')).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'a' }] },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'b' }] },
      ],
    });
  });

  it('extrae texto de documentos enriquecidos (fase 4)', () => {
    const doc = parseDoc(
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Hola ' },
              { type: 'text', text: 'mundo', marks: [{ type: 'bold' }] },
            ],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'uno' }] }],
              },
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'dos' }] }],
              },
            ],
          },
        ],
      }),
    );
    expect(docToText(doc)).toBe('Hola mundo\nuno\ndos');
  });

  it('trata el JSON inválido como documento vacío', () => {
    expect(parseDoc('{no es json')).toEqual({ type: 'doc', content: [] });
    expect(parseDoc(null)).toEqual({ type: 'doc', content: [] });
    expect(parseDoc('{"type":"otro"}')).toEqual({ type: 'doc', content: [] });
  });

  it('serializa y vuelve a leer', () => {
    const doc = textToDoc('x\ny');
    expect(parseDoc(serializeDoc(doc))).toEqual(doc);
  });
});

describe('imágenes en el texto', () => {
  const doc = {
    type: 'doc' as const,
    content: [
      { type: 'paragraph', content: [{ type: 'text' as const, text: 'antes' }] },
      { type: 'attachmentImage', attrs: { id: 'a1' } },
      {
        type: 'blockquote',
        content: [{ type: 'attachmentImage', attrs: { id: 'a2' } }],
      },
    ],
  };

  it('lista los ids de los adjuntos del texto (también anidados)', () => {
    expect([...inlineImageIds(doc)].sort()).toEqual(['a1', 'a2']);
    expect(inlineImageIds({ type: 'doc', content: [] }).size).toBe(0);
  });

  it('al duplicar, apunta a los adjuntos nuevos sin tocar el original', () => {
    const copy = remapInlineImages(
      doc,
      new Map([
        ['a1', 'b1'],
        ['a2', 'b2'],
      ]),
    );
    expect([...inlineImageIds(copy)].sort()).toEqual(['b1', 'b2']);
    expect([...inlineImageIds(doc)].sort()).toEqual(['a1', 'a2']);
    expect(docToText(copy)).toBe(docToText(doc));
  });
});

describe('enlaces a notas', () => {
  const linked = {
    type: 'doc' as const,
    content: [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Ver ' },
          { type: 'noteLink', attrs: { id: 'n2', title: 'Receta' } },
        ],
      },
    ],
  };

  it('el título del enlace forma parte del texto (búsqueda y vista previa)', () => {
    expect(docToText(linked)).toBe('Ver Receta');
  });

  it('lista las notas enlazadas', () => {
    expect([...linkedNoteIds(linked)]).toEqual(['n2']);
  });
});
