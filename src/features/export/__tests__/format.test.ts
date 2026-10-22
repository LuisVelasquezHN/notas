import type { EditorDoc } from '@/features/editor/doc';

import {
  docToMarkdown,
  exportFileName,
  noteToHtml,
  noteToMarkdown,
  noteToPlainText,
} from '../format';

const text = (value: string, marks?: string[]) => ({
  type: 'text' as const,
  text: value,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});
const p = (...content: ReturnType<typeof text>[]) => ({ type: 'paragraph', content });

const DOC: EditorDoc = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1 }, content: [text('Plan')] },
    p(text('Hola '), text('mundo', ['bold']), text(' y '), text('código', ['code'])),
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [p(text('uno'))] },
        {
          type: 'listItem',
          content: [
            p(text('dos')),
            { type: 'bulletList', content: [{ type: 'listItem', content: [p(text('dos.a'))] }] },
          ],
        },
      ],
    },
    {
      type: 'taskList',
      content: [
        { type: 'taskItem', attrs: { checked: true }, content: [p(text('hecho'))] },
        { type: 'taskItem', attrs: { checked: false }, content: [p(text('pendiente'))] },
      ],
    },
    {
      type: 'orderedList',
      attrs: { start: 3 },
      content: [{ type: 'listItem', content: [p(text('tres'))] }],
    },
    { type: 'blockquote', content: [p(text('cita'))] },
    { type: 'codeBlock', content: [text('let a = 1;')] },
  ],
};

describe('exportar', () => {
  it('convierte el documento a Markdown', () => {
    expect(docToMarkdown(DOC)).toBe(
      [
        '# Plan',
        'Hola **mundo** y `código`',
        '- uno\n- dos\n  - dos.a',
        '- [x] hecho\n- [ ] pendiente',
        '3. tres',
        '> cita',
        '```\nlet a = 1;\n```',
      ].join('\n\n'),
    );
  });

  it('escapa los caracteres de Markdown del texto', () => {
    expect(docToMarkdown({ type: 'doc', content: [p(text('2*3 = _seis_'))] })).toBe(
      '2\\*3 = \\_seis\\_',
    );
  });

  it('exporta una lista con título y etiquetas', () => {
    const note = {
      title: 'Compra',
      items: [
        { text: 'Pan', isChecked: false, indent: 0 },
        { text: 'Integral', isChecked: false, indent: 1 },
        { text: 'Leche', isChecked: true, indent: 0 },
      ],
      tags: ['casa', 'mi lista'],
    };
    expect(noteToMarkdown(note)).toBe(
      '# Compra\n\n- [ ] Pan\n  - [ ] Integral\n- [x] Leche\n\n#casa #mi_lista\n',
    );
    expect(noteToPlainText(note)).toBe(
      'Compra\n\n☐ Pan\n  ☐ Integral\n☑ Leche\n\n#casa #mi_lista\n',
    );
  });

  it('el HTML escapa el contenido', () => {
    const html = noteToHtml(
      { title: '<b>x</b>', doc: { type: 'doc', content: [p(text('a < b & c'))] }, tags: [] },
      'es',
    );
    expect(html).toContain('<h1>&lt;b&gt;x&lt;/b&gt;</h1>');
    expect(html).toContain('<p>a &lt; b &amp; c</p>');
    expect(html).toContain('lang="es"');
  });

  it('exporta color, resaltado, tamaño e "Importante"', () => {
    const styled = (value: string, mark: { type: string; attrs?: Record<string, unknown> }) => ({
      type: 'text' as const,
      text: value,
      marks: [mark],
    });
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            styled('rojo', { type: 'textStyle', attrs: { color: 'var(--lv-text-red)' } }),
            styled('grande', { type: 'textStyle', attrs: { fontSize: 'var(--lv-size-large)' } }),
            styled('marca', { type: 'highlight', attrs: { color: 'var(--lv-mark-yellow)' } }),
            styled('ojo', { type: 'important' }),
            // Un valor que no es un token de la app no llega al HTML.
            styled('x', { type: 'textStyle', attrs: { color: 'red;background:url(evil)' } }),
          ],
        },
      ],
    } as EditorDoc;
    const html = noteToHtml({ title: '', doc, tags: [] }, 'es');
    expect(html).toContain('<span style="color:#D13B3B">rojo</span>');
    expect(html).toContain('<span style="font-size:1.25em">grande</span>');
    expect(html).toContain('<mark style="background-color:#FFF3A3">marca</mark>');
    expect(html).toContain('<span class="important">ojo</span>');
    expect(html).not.toContain('evil');
    // En Markdown: resaltado como ==texto== e "Importante" como negrita; color y tamaño se pierden.
    expect(docToMarkdown(doc)).toBe('rojogrande==marca==**ojo**x');
  });

  it('genera nombres de fichero seguros', () => {
    expect(exportFileName('Ideas: 2026/10', 'md', 'Nota')).toBe('Ideas 2026 10.md');
    expect(exportFileName('   ', 'pdf', 'Nota')).toBe('Nota.pdf');
  });
});
