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

const INLINE_NODES = new Set(['text', 'hardBreak', 'noteLink']);

function nodeText(node: DocNode | TextNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === NOTE_LINK_NODE) return noteLinkTitle(node as DocNode);
  const children: (DocNode | TextNode)[] = (node as DocNode).content ?? [];
  // Bloques anidados (listas, citas…) en líneas separadas; texto en línea, concatenado.
  const isBlockContainer = children.some((c) => !INLINE_NODES.has(c.type));
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

/** Nodo de imagen dentro del texto: apunta a un adjunto `inline` por su id. */
export const INLINE_IMAGE_NODE = 'attachmentImage';

/** Tamaños de una imagen del texto (respecto al ancho de la nota). */
export const IMAGE_SIZES = ['small', 'medium', 'full'] as const;
export type ImageSize = (typeof IMAGE_SIZES)[number];

export const isImageSize = (value: unknown): value is ImageSize =>
  typeof value === 'string' && (IMAGE_SIZES as readonly string[]).includes(value);

/** Enlace a otra nota (`[[`): guarda su id y el título que tenía al enlazarla. */
export const NOTE_LINK_NODE = 'noteLink';
export const MAX_NOTE_LINK_TITLE = 120;

export function noteLinkTitle(node: DocNode): string {
  const title = node.attrs?.title;
  return typeof title === 'string' ? title.slice(0, MAX_NOTE_LINK_TITLE) : '';
}

/** Ids de las notas enlazadas desde el documento. */
export function linkedNoteIds(doc: EditorDoc): Set<string> {
  const ids = new Set<string>();
  walk(doc.content, (node) => {
    const id = node.attrs?.id;
    if (node.type === NOTE_LINK_NODE && typeof id === 'string') ids.add(id);
  });
  return ids;
}

function walk(nodes: (DocNode | TextNode)[] | undefined, visit: (node: DocNode) => void) {
  for (const node of nodes ?? []) {
    if (node.type === 'text') continue;
    visit(node as DocNode);
    walk((node as DocNode).content, visit);
  }
}

/** Ids de los adjuntos que aparecen como imagen en el texto. */
export function inlineImageIds(doc: EditorDoc): Set<string> {
  const ids = new Set<string>();
  walk(doc.content, (node) => {
    const id = node.attrs?.id;
    if (node.type === INLINE_IMAGE_NODE && typeof id === 'string') ids.add(id);
  });
  return ids;
}

/** Copia del documento con las imágenes del texto apuntando a otros adjuntos (duplicar). */
export function remapInlineImages(doc: EditorDoc, ids: Map<string, string>): EditorDoc {
  const map = (nodes: (DocNode | TextNode)[] | undefined): (DocNode | TextNode)[] | undefined =>
    nodes?.map((node) => {
      if (node.type === 'text') return node;
      const n = node as DocNode;
      const id = n.attrs?.id;
      const next: DocNode = { ...n, content: map(n.content) as DocNode['content'] };
      if (n.content === undefined) delete next.content;
      if (n.type === INLINE_IMAGE_NODE && typeof id === 'string' && ids.has(id)) {
        next.attrs = { ...n.attrs, id: ids.get(id) };
      }
      return next;
    });
  return { type: 'doc', content: (map(doc.content) ?? []) as DocNode[] };
}
