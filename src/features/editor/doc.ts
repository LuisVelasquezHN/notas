/**
 * Formato de almacenamiento del contenido: documento ProseMirror/TipTap (PLAN.md, decisión 4).
 * El editor de texto plano solo produce párrafos, pero el formato ya es el definitivo:
 * al pasar a TipTap en la fase 4 no hay migración de datos.
 */

export type TextNode = { type: 'text'; text: string; marks?: { type: string }[] };

export type DocNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: (DocNode | TextNode)[];
  text?: string;
};

export type EditorDoc = { type: 'doc'; content: DocNode[] };

export function emptyDoc(): EditorDoc {
  return { type: 'doc', content: [] };
}

/** Texto plano → documento: una línea por párrafo (las líneas vacías son párrafos vacíos). */
export function textToDoc(text: string): EditorDoc {
  if (text === '') return emptyDoc();
  return {
    type: 'doc',
    content: text
      .split('\n')
      .map((line) =>
        line === ''
          ? { type: 'paragraph' }
          : { type: 'paragraph', content: [{ type: 'text', text: line }] },
      ),
  };
}

/**
 * Documento → texto plano. Los bloques de primer nivel se separan con un salto de línea, de modo que
 * `docToText(textToDoc(s)) === s` para cualquier texto.
 */
export function docToText(doc: EditorDoc | null | undefined): string {
  if (!doc?.content?.length) return '';
  return doc.content.map(nodeText).join('\n');
}

function nodeText(node: DocNode | TextNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const children: (DocNode | TextNode)[] = (node as DocNode).content ?? [];
  // Bloques anidados (listas, citas…) en líneas separadas; texto en línea, concatenado.
  const isBlockContainer = children.some((c) => c.type !== 'text' && c.type !== 'hardBreak');
  return children.map(nodeText).join(isBlockContainer ? '\n' : '');
}

export function parseDoc(json: string | null | undefined): EditorDoc {
  if (!json) return emptyDoc();
  try {
    const value: unknown = JSON.parse(json);
    if (
      value &&
      typeof value === 'object' &&
      (value as EditorDoc).type === 'doc' &&
      Array.isArray((value as EditorDoc).content)
    ) {
      return value as EditorDoc;
    }
  } catch {
    // Contenido corrupto: se trata como vacío en vez de romper el editor.
  }
  return emptyDoc();
}

export function serializeDoc(doc: EditorDoc): string {
  return JSON.stringify(doc);
}
