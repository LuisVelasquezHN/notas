import { docToText, parseDoc, serializeDoc, textToDoc } from '../doc';

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
