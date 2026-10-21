import { docToText, type DocNode, type EditorDoc, type TextNode } from '@/features/editor/doc';

/**
 * Conversión de una nota a Markdown, texto plano o HTML (para el PDF). Funciones puras: los datos
 * los reúne `actions.ts`.
 */

export type ExportItem = { text: string; isChecked: boolean; indent: number };

export type ExportNote = {
  title: string;
  /** Documento TipTap (notas de texto). */
  doc?: EditorDoc;
  /** Ítems en el orden en que se muestran (notas de lista). */
  items?: ExportItem[];
  tags: string[];
  /** Imágenes como data URI (solo para el HTML/PDF). */
  images?: string[];
};

type Node = DocNode | TextNode;

// --- Markdown ---------------------------------------------------------------------------------

const escapeMarkdown = (text: string) => text.replace(/([\\`*_[\]])/g, '\\$1');

function inlineMarkdown(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '  \n';
      if (node.type !== 'text') return inlineMarkdown((node as DocNode).content);
      const text = node.text ?? '';
      const marks = (node as TextNode).marks ?? [];
      const has = (type: string) => marks.some((m) => m.type === type);
      // El código en línea no admite otros formatos ni escapes.
      if (has('code')) return `\`${text}\``;
      let out = escapeMarkdown(text);
      if (has('bold')) out = `**${out}**`;
      if (has('italic')) out = `*${out}*`;
      if (has('strike')) out = `~~${out}~~`;
      const link = marks.find((m) => m.type === 'link') as
        { attrs?: { href?: string } } | undefined;
      if (link?.attrs?.href) out = `[${out}](${link.attrs.href})`;
      return out;
    })
    .join('');
}

const indentLines = (text: string, prefix: string) =>
  text
    .split('\n')
    .map((line) => (line ? prefix + line : line))
    .join('\n');

/** Un elemento de lista: la primera línea tras la viñeta y el resto (sublistas) sangrado. */
function listItemMarkdown(item: DocNode, bullet: string): string {
  const [first, ...rest] = item.content ?? [];
  const head = first ? blockMarkdown(first as DocNode) : '';
  const tail = rest.map((child) => blockMarkdown(child as DocNode)).filter(Boolean);
  const pad = ' '.repeat(bullet.length);
  return [bullet + head, ...tail.map((block) => indentLines(block, pad))].join('\n');
}

function blockMarkdown(node: DocNode): string {
  switch (node.type) {
    case 'paragraph':
      return inlineMarkdown(node.content);
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? 1)));
      return `${'#'.repeat(level)} ${inlineMarkdown(node.content)}`;
    }
    case 'bulletList':
      return (node.content ?? []).map((item) => listItemMarkdown(item as DocNode, '- ')).join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, i) => listItemMarkdown(item as DocNode, `${start + i}. `))
        .join('\n');
    }
    case 'taskList':
      return (node.content ?? [])
        .map((item) =>
          listItemMarkdown(item as DocNode, (item as DocNode).attrs?.checked ? '- [x] ' : '- [ ] '),
        )
        .join('\n');
    case 'blockquote':
      return (node.content ?? [])
        .map((child) => blockMarkdown(child as DocNode))
        .join('\n\n')
        .split('\n')
        .map((line) => (line ? `> ${line}` : '>'))
        .join('\n');
    case 'codeBlock':
      return `\`\`\`\n${docToText({ type: 'doc', content: [node] })}\n\`\`\``;
    case 'horizontalRule':
      return '---';
    default:
      return node.content ? inlineMarkdown(node.content) : '';
  }
}

export function docToMarkdown(doc: EditorDoc): string {
  return doc.content
    .map(blockMarkdown)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function itemsToMarkdown(items: ExportItem[]): string {
  return items
    .map(
      (item) =>
        `${'  '.repeat(item.indent)}- [${item.isChecked ? 'x' : ' '}] ${escapeMarkdown(item.text)}`,
    )
    .join('\n');
}

const tagLine = (tags: string[]) => tags.map((tag) => `#${tag.replace(/\s+/g, '_')}`).join(' ');

export function noteToMarkdown(note: ExportNote): string {
  const parts = [
    note.title.trim() ? `# ${escapeMarkdown(note.title.trim())}` : null,
    note.items ? itemsToMarkdown(note.items) : note.doc ? docToMarkdown(note.doc) : null,
    note.tags.length > 0 ? tagLine(note.tags) : null,
  ];
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

// --- Texto plano --------------------------------------------------------------------------------

export function noteToPlainText(note: ExportNote): string {
  const body = note.items
    ? note.items
        .map((item) => `${'  '.repeat(item.indent)}${item.isChecked ? '☑' : '☐'} ${item.text}`)
        .join('\n')
    : note.doc
      ? docToText(note.doc)
      : '';
  const parts = [note.title.trim() || null, body.trim() || null, tagLine(note.tags) || null];
  return `${parts.filter(Boolean).join('\n\n')}\n`;
}

// --- HTML (PDF) ---------------------------------------------------------------------------------

export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MARK_TAGS: Record<string, string> = {
  bold: 'strong',
  italic: 'em',
  underline: 'u',
  strike: 's',
  code: 'code',
};

function inlineHtml(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      if (node.type !== 'text') return inlineHtml((node as DocNode).content);
      let out = escapeHtml(node.text ?? '');
      for (const mark of (node as TextNode).marks ?? []) {
        const tag = MARK_TAGS[mark.type];
        if (tag) out = `<${tag}>${out}</${tag}>`;
      }
      return out;
    })
    .join('');
}

function blockHtml(node: DocNode): string {
  const children = () => (node.content ?? []).map((c) => blockHtml(c as DocNode)).join('');
  switch (node.type) {
    case 'paragraph':
      return `<p>${inlineHtml(node.content) || '&nbsp;'}</p>`;
    case 'heading': {
      // El título de la nota es el h1: los títulos del contenido bajan un nivel.
      const level = Math.min(6, Number(node.attrs?.level ?? 1) + 1);
      return `<h${level}>${inlineHtml(node.content)}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${children()}</ul>`;
    case 'orderedList':
      return `<ol start="${Number(node.attrs?.start ?? 1)}">${children()}</ol>`;
    case 'listItem':
      return `<li>${children()}</li>`;
    case 'taskList':
      return `<ul class="tasks">${children()}</ul>`;
    case 'taskItem':
      return `<li class="${node.attrs?.checked ? 'done' : ''}"><span class="box">${
        node.attrs?.checked ? '☑' : '☐'
      }</span><div>${children()}</div></li>`;
    case 'blockquote':
      return `<blockquote>${children()}</blockquote>`;
    case 'codeBlock':
      return `<pre><code>${escapeHtml(docToText({ type: 'doc', content: [node] }))}</code></pre>`;
    case 'horizontalRule':
      return '<hr>';
    default:
      return node.content ? `<p>${inlineHtml(node.content)}</p>` : '';
  }
}

const STYLES = `
  body { font-family: -apple-system, system-ui, Roboto, "Segoe UI", sans-serif; color: #1c1c1a;
         font-size: 12pt; line-height: 1.5; margin: 32px; }
  h1 { font-size: 20pt; margin: 0 0 16px; }
  h2 { font-size: 15pt; margin: 20px 0 8px; }
  h3 { font-size: 13pt; margin: 16px 0 6px; }
  p { margin: 0 0 8px; }
  blockquote { border-left: 3px solid #ccc; margin: 8px 0; padding-left: 12px; color: #555; }
  pre { background: #f2f2ee; padding: 12px; border-radius: 6px; white-space: pre-wrap; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 10.5pt; }
  ul.tasks { list-style: none; padding-left: 0; }
  ul.tasks li { display: flex; gap: 8px; }
  ul.tasks li.done div { text-decoration: line-through; color: #888; }
  ul.tasks .box { flex: none; }
  .images { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .images img { max-width: 100%; max-height: 360px; border-radius: 6px; }
  .tags { margin-top: 24px; color: #666; font-size: 10pt; }
`;

export function noteToHtml(note: ExportNote, lang: string): string {
  const items = note.items
    ? `<ul class="tasks">${note.items
        .map(
          (item) =>
            `<li class="${item.isChecked ? 'done' : ''}" style="margin-left:${item.indent * 20}px"><span class="box">${
              item.isChecked ? '☑' : '☐'
            }</span><div>${escapeHtml(item.text)}</div></li>`,
        )
        .join('')}</ul>`
    : '';
  const body = note.items ? items : note.doc ? note.doc.content.map(blockHtml).join('') : '';
  const images = note.images?.length
    ? `<div class="images">${note.images.map((src) => `<img src="${src}">`).join('')}</div>`
    : '';
  const title = note.title.trim();
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title><style>${STYLES}</style></head><body>
${title ? `<h1>${escapeHtml(title)}</h1>` : ''}${images}${body}
${note.tags.length > 0 ? `<p class="tags">${escapeHtml(tagLine(note.tags))}</p>` : ''}
</body></html>`;
}

// --- Nombres de fichero -------------------------------------------------------------------------

/** Nombre de fichero seguro a partir del título ("Lista de la compra.md"). */
export function exportFileName(title: string, extension: string, fallback: string): string {
  const base =
    title
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || fallback;
  return `${base}.${extension}`;
}
