'use dom';

import { Extension, InputRule, Mark, Node, mergeAttributes } from '@tiptap/core';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from 'expo/dom';
import { useEffect, useRef, type Ref } from 'react';

import {
  INLINE_IMAGE_NODE,
  MAX_NOTE_LINK_TITLE,
  NOTE_LINK_NODE,
  isImageSize,
  type EditorDoc,
  type ImageSize,
} from '../doc';
import {
  parseFormatAction,
  sameFormatState,
  styleVar,
  styleVariables,
  tokenFromVar,
  type FontFamilyName,
  type FontSizeName,
  type FormatAction,
  type FormatState,
  type HighlightColor,
  type TextColor,
} from '../format';

/**
 * Editor TipTap como DOM component (`'use dom'`): en iOS y Android se ejecuta dentro de una
 * webview (`@expo/dom-webview`) y en web como un componente normal. Mismo código en las tres.
 *
 * Solo recibe y devuelve valores serializables (cruzan un puente asíncrono en nativo).
 * Es "casi controlado": emite el documento al cambiar y solo reemplaza su contenido cuando
 * `content` no coincide con lo último que emitió (deshacer/rehacer de la pantalla).
 */

type JSONValue = Parameters<DOMImperativeFactory[string]>[number];

/** Los métodos del ref cruzan el puente: sus argumentos llegan como JSON sin tipar. */
export interface TipTapHandle extends DOMImperativeFactory {
  format: (command: JSONValue) => void;
  focus: () => void;
  insertText: (text: JSONValue) => void;
  insertImages: (ids: JSONValue) => void;
  insertNoteLink: (id: JSONValue, title: JSONValue) => void;
  requestSelection: () => void;
}

/** Atajos que gestiona la pantalla (el historial de deshacer vive fuera del editor). */
export type EditorShortcut = 'undo' | 'redo' | 'save' | 'reading';

/** Imagen pegada o arrastrada al editor (web, y en la webview si el sistema lo permite). */
export type DroppedImage = { dataUri: string; width: number; height: number };

export type TipTapTheme = {
  scheme: 'light' | 'dark';
  text: string;
  muted: string;
  primary: string;
  codeBackground: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  minHeight: number;
};

type Props = {
  ref?: Ref<TipTapHandle>;
  dom?: DOMProps;
  content: EditorDoc;
  editable: boolean;
  placeholder: string;
  /** Nombre accesible del área de texto (lectores de pantalla dentro de la webview). */
  label: string;
  autoFocus: boolean;
  theme: TipTapTheme;
  onChange: (doc: EditorDoc) => Promise<void> | void;
  onFormatChange: (state: FormatState) => Promise<void> | void;
  onFocusChange: (focused: boolean) => Promise<void> | void;
  /** Parte inferior del cursor, en px desde el borde superior del editor (para hacer scroll). */
  onCaret: (bottom: number) => Promise<void> | void;
  /** Texto seleccionado, cuando se pide con `requestSelection` (los métodos no devuelven nada). */
  onSelectionText: (text: string) => Promise<void> | void;
  /** Alto del contenido en px (en la webview, para que la pantalla le dé el tamaño justo). */
  onHeight: (height: number) => Promise<void> | void;
  /** Contenido de las imágenes del texto (`id del adjunto → URI`, data URI en la webview). */
  images: Record<string, string>;
  onShortcut: (shortcut: EditorShortcut) => Promise<void> | void;
  onImageFiles: (images: DroppedImage[]) => Promise<void> | void;
  /** Abrir a pantalla completa una imagen del texto (tocarla ya seleccionada, o en lectura). */
  onOpenImage: (id: string) => Promise<void> | void;
  /** Tocar un enlace a otra nota. */
  onOpenNote: (id: string) => Promise<void> | void;
  /** Se ha escrito `[[`: la pantalla muestra el buscador de notas (y llama a `insertNoteLink`). */
  onLinkRequest: () => Promise<void> | void;
};

/** URI de cada imagen del texto (las actualiza el efecto de `images`). */
const imageSources = new Map<string, string>();

/**
 * Imagen dentro del texto: un adjunto (`placement: 'inline'`) referenciado por su id. El
 * documento solo guarda el id; el contenido llega por `images` (no cabe en el JSON de la nota).
 */
const AttachmentImage = Node.create({
  name: INLINE_IMAGE_NODE,
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      id: { default: null },
      // Las imágenes de notas anteriores no lo tienen: tamaño completo.
      size: {
        default: 'full',
        parseHTML: (el) => sizeOf(el.getAttribute('data-size')),
        renderHTML: (attrs) => ({ 'data-size': sizeOf(attrs.size) }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[data-attachment-id]',
        getAttrs: (el) => ({ id: (el as HTMLElement).getAttribute('data-attachment-id') }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      {
        'data-attachment-id': HTMLAttributes.id,
        'data-size': HTMLAttributes['data-size'],
        class: 'lv-inline-image',
        alt: '',
      },
    ];
  },
  addNodeView() {
    return ({ node }) => {
      const img = document.createElement('img');
      img.className = 'lv-inline-image';
      img.alt = '';
      img.draggable = true;
      img.dataset.attachmentId = String(node.attrs.id ?? '');
      img.dataset.size = sizeOf(node.attrs.size);
      const src = imageSources.get(img.dataset.attachmentId);
      if (src) img.src = src;
      return { dom: img };
    };
  },
});

/**
 * Tras insertar algo elegido en una hoja (enlace, contraseña…): al cerrarse la hoja, el navegador
 * devuelve el foco al editor y el cursor saltaba al principio. Se vuelve a dejar donde estaba.
 */
function keepCaret(editor: Editor, at: number = editor.state.selection.to) {
  const restore = () => {
    if (!editor.isDestroyed) editor.commands.focus(at);
  };
  restore();
  // El foco vuelve al terminar la animación de cierre: se recoloca justo después.
  const onFocus = () => setTimeout(restore, 0);
  const dom = editor.view.dom;
  dom.addEventListener('focus', onFocus, { once: true });
  setTimeout(() => dom.removeEventListener('focus', onFocus), 1500);
}

const sizeOf = (value: unknown): ImageSize => (isImageSize(value) ? value : 'full');

/**
 * Enlace a otra nota: una "pastilla" con su título. Se crea escribiendo `[[` (la pantalla muestra
 * un buscador de notas) y tocarla abre la nota.
 */
const NoteLink = Node.create({
  name: NOTE_LINK_NODE,
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return { id: { default: null }, title: { default: '' } };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-note-link]',
        getAttrs: (el) => ({
          id: (el as HTMLElement).getAttribute('data-note-link'),
          title: (el as HTMLElement).textContent ?? '',
        }),
      },
    ];
  },
  renderHTML({ node }) {
    return [
      'span',
      { 'data-note-link': node.attrs.id, class: 'lv-note-link', role: 'link' },
      String(node.attrs.title ?? ''),
    ];
  },
  renderText({ node }) {
    return String(node.attrs.title ?? '');
  },
  addInputRules() {
    return [
      new InputRule({
        find: /\[\[$/,
        handler: ({ state, range }) => {
          state.tr.delete(range.from, range.to);
          // Al volver de la hoja, el enlace va aquí (el cursor puede haberse movido al perder el foco).
          linkPositions.set(this.editor, range.from);
          hostHandlers.get(this.editor)?.linkRequest();
        },
      }),
    ];
  },
});

/** Lee imágenes (pegadas o soltadas) como data URI con sus dimensiones. */
async function readImageFiles(files: FileList | null | undefined): Promise<DroppedImage[]> {
  const images = Array.from(files ?? []).filter((f) => f.type.startsWith('image/'));
  return Promise.all(
    images.map(
      (file) =>
        new Promise<DroppedImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = () => reject(reader.error);
          reader.onload = () => {
            const dataUri = String(reader.result);
            const img = new Image();
            img.onload = () =>
              resolve({ dataUri, width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () => resolve({ dataUri, width: 0, height: 0 });
            img.src = dataUri;
          };
          reader.readAsDataURL(file);
        }),
    ),
  );
}

const hasImageFiles = (files: FileList | null | undefined) =>
  !!files?.length && Array.from(files).some((f) => f.type.startsWith('image/'));

/** "Importante": texto destacado (negrita en rojo sobre fondo suave). Se guarda como marca propia. */
const Important = Mark.create({
  name: 'important',
  parseHTML() {
    return [{ tag: 'span[data-important]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, { 'data-important': '', class: 'lv-important' }),
      0,
    ];
  },
});

const IN_WEBVIEW = Boolean(process.env.EXPO_DOM_HOST_OS);

/** En la webview cada cambio cruza el puente: se agrupan las pulsaciones seguidas. */
const EMIT_DELAY = IN_WEBVIEW ? 150 : 0;

export default function TipTapDom({
  ref,
  content,
  editable,
  placeholder,
  label,
  autoFocus,
  theme,
  onChange,
  onFormatChange,
  onFocusChange,
  onCaret,
  onSelectionText,
  onHeight,
  images,
  onShortcut,
  onImageFiles,
  onOpenImage,
  onOpenNote,
  onLinkRequest,
}: Props) {
  const lastEmitted = useRef(JSON.stringify(content));
  const lastFormat = useRef<FormatState>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = useRef({
    onChange,
    onFormatChange,
    onFocusChange,
    onCaret,
    onSelectionText,
    onHeight,
    onShortcut,
    onImageFiles,
    onOpenImage,
    onOpenNote,
    onLinkRequest,
  });
  useEffect(() => {
    callbacks.current = {
      onChange,
      onFormatChange,
      onFocusChange,
      onCaret,
      onSelectionText,
      onHeight,
      onShortcut,
      onImageFiles,
      onOpenImage,
      onOpenNote,
      onLinkRequest,
    };
  });
  const rootRef = useRef<HTMLDivElement>(null);

  const emitNow = (editor: Editor) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const doc = editor.getJSON() as EditorDoc;
    const json = JSON.stringify(doc);
    if (json === lastEmitted.current) return;
    lastEmitted.current = json;
    void callbacks.current.onChange(doc);
  };

  const reportSelection = (editor: Editor) => {
    const state = formatState(editor);
    if (!sameFormatState(state, lastFormat.current)) {
      lastFormat.current = state;
      void callbacks.current.onFormatChange(state);
    }
    if (editor.isFocused) {
      try {
        const coords = editor.view.coordsAtPos(editor.state.selection.head);
        // En la webview, respecto a lo visible de la webview (puede desplazarse por dentro); en
        // web, respecto al principio del editor.
        const top = IN_WEBVIEW ? 0 : editor.view.dom.getBoundingClientRect().top;
        void callbacks.current.onCaret(Math.round(coords.bottom - top));
      } catch {
        // Posición fuera del documento durante una transacción: se ignora.
      }
    }
  };

  const editor = useEditor({
    // En web (React DOM normal) se evita renderizar en el primer pase sin el DOM listo.
    immediatelyRender: false,
    editable,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': label },
      // Imagen del texto: el primer toque la selecciona (tamaño, mover) y el segundo la abre; en
      // lectura, el primero. Un enlace a otra nota se abre siempre.
      handleClickOn: (view, _pos, node, nodePos, _event, direct) => {
        if (!direct) return false;
        if (node.type.name === NOTE_LINK_NODE && typeof node.attrs.id === 'string') {
          void callbacks.current.onOpenNote(node.attrs.id);
          return true;
        }
        if (node.type.name !== INLINE_IMAGE_NODE || typeof node.attrs.id !== 'string') return false;
        const { selection } = view.state;
        const selected = selection instanceof NodeSelection && selection.from === nodePos;
        if (!view.editable || selected) {
          void callbacks.current.onOpenImage(node.attrs.id);
          return true;
        }
        return false;
      },
      // Imágenes pegadas o soltadas: se añaden como adjuntos y se insertan en el cursor.
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        if (!hasImageFiles(files)) return false;
        void readImageFiles(files).then((imgs) => callbacks.current.onImageFiles(imgs));
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = (event as DragEvent).dataTransfer?.files;
        if (moved || !hasImageFiles(files)) return false;
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (pos) {
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos.pos)));
        }
        event.preventDefault();
        void readImageFiles(files).then((imgs) => callbacks.current.onImageFiles(imgs));
        return true;
      },
    },
    content,
    extensions: [
      StarterKit.configure({
        // El historial vive en la pantalla (deshacer/rehacer comparte título y contenido).
        undoRedo: false,
        heading: { levels: [1, 2] },
        // Dentro de la webview un clic en un enlace navegaría fuera de la nota.
        link: { openOnClick: false, autolink: true },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      Important,
      AttachmentImage,
      NoteLink,
      Shortcuts,
      Placeholder.configure({ placeholder }),
    ],
    onUpdate: ({ editor }) => {
      if (EMIT_DELAY === 0) emitNow(editor);
      else {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => emitNow(editor), EMIT_DELAY);
      }
    },
    onSelectionUpdate: ({ editor }) => reportSelection(editor),
    onTransaction: ({ editor }) => reportSelection(editor),
    onFocus: ({ editor }) => {
      void callbacks.current.onFocusChange(true);
      reportSelection(editor);
    },
    onBlur: ({ editor }) => {
      // Al perder el foco no se espera al temporizador: el autoguardado puede llegar justo después.
      emitNow(editor);
      void callbacks.current.onFocusChange(false);
    },
  });

  // Cambios desde fuera (deshacer/rehacer): se sustituye el contenido sin volver a emitirlo.
  useEffect(() => {
    if (!editor) return;
    const json = JSON.stringify(content);
    if (json === lastEmitted.current) return;
    lastEmitted.current = json;
    editor.commands.setContent(content, { emitUpdate: false });
  }, [editor, content]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;
    hostHandlers.set(editor, {
      shortcut: (s) => void callbacks.current.onShortcut(s),
      linkRequest: () => void callbacks.current.onLinkRequest(),
    });
  }, [editor]);

  // Contenido de las imágenes del texto: se guarda para los nodos nuevos y se actualiza en los ya
  // pintados (al descargarse de la nube, al deshacer…).
  useEffect(() => {
    imageSources.clear();
    for (const [id, src] of Object.entries(images)) imageSources.set(id, src);
    document.querySelectorAll<HTMLImageElement>('img[data-attachment-id]').forEach((img) => {
      const src = imageSources.get(img.dataset.attachmentId ?? '');
      if (src && img.getAttribute('src') !== src) img.src = src;
    });
  }, [images]);

  // Alto real del contenido: lo mide el propio editor (la medición automática de la webview se
  // quedaba corta y, en Android, una webview más alta que la pantalla se dibuja en blanco).
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let last = 0;
    const report = () => {
      const height = Math.ceil(el.getBoundingClientRect().height);
      if (height !== last) {
        last = height;
        void callbacks.current.onHeight(height);
      }
    };
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, [editor]);

  useEffect(
    () => () => {
      if (editor && timer.current) emitNow(editor);
    },
    // Solo al desmontar: se emite lo pendiente para no perder las últimas pulsaciones.
    [editor],
  );

  useDOMImperativeHandle(
    ref ?? null,
    () => ({
      format: (command: JSONValue) => {
        const action = parseFormatAction(command);
        if (editor && action) applyFormat(editor, action);
      },
      focus: () => {
        editor?.commands.focus();
      },
      insertImages: (ids: JSONValue) => {
        if (!editor || !Array.isArray(ids)) return;
        const nodes = ids
          .filter((id): id is string => typeof id === 'string')
          .map((id) => ({ type: INLINE_IMAGE_NODE, attrs: { id } }));
        // Tras la imagen, un párrafo para seguir escribiendo.
        if (nodes.length) {
          // En la selección guardada: al volver de una hoja, `focus()` la movería al principio.
          const { from, to } = editor.state.selection;
          editor
            .chain()
            .insertContentAt({ from, to }, [...nodes, { type: 'paragraph' }])
            .run();
          keepCaret(editor);
        }
      },
      insertNoteLink: (id: JSONValue, title: JSONValue) => {
        if (!editor || typeof id !== 'string' || !id) return;
        const text = typeof title === 'string' ? title.slice(0, MAX_NOTE_LINK_TITLE) : '';
        const size = editor.state.doc.content.size;
        const saved = linkPositions.get(editor);
        linkPositions.delete(editor);
        const at = Math.min(saved ?? editor.state.selection.from, size);
        editor
          .chain()
          .insertContentAt(at, [
            { type: NOTE_LINK_NODE, attrs: { id, title: text } },
            { type: 'text', text: ' ' },
          ])
          .run();
        // Tras el enlace (1) y el espacio (1).
        keepCaret(editor, Math.min(at + 2, editor.state.doc.content.size));
      },
      insertText: (text: JSONValue) => {
        // Como nodo de texto: con una cadena, TipTap la interpretaría como HTML.
        if (editor && typeof text === 'string' && text) {
          const { from, to } = editor.state.selection;
          editor.chain().insertContentAt({ from, to }, { type: 'text', text }).run();
          keepCaret(editor, from + text.length);
        }
      },
      requestSelection: () => {
        if (!editor) return;
        const { from, to } = editor.state.selection;
        void callbacks.current.onSelectionText(editor.state.doc.textBetween(from, to, '\n'));
      },
    }),
    [editor],
  );

  return (
    <div ref={rootRef}>
      <style>{css(theme)}</style>
      <EditorContent
        editor={editor}
        className="notas-editor"
        // Tocar el hueco bajo el texto también enfoca el editor (al final).
        onClick={(e) => {
          if (editor && e.target === e.currentTarget) editor.commands.focus('end');
        }}
      />
    </div>
  );
}

/**
 * Atajos de teclado (también con teclado físico en el móvil). Deshacer/rehacer van al historial de
 * la pantalla (título + contenido); los de formato que no trae TipTap, aquí.
 */
/**
 * Lo que las extensiones piden a la pantalla, por editor (lo registra el componente, que conoce
 * las props).
 */
type HostHandlers = { shortcut: (s: EditorShortcut) => void; linkRequest: () => void };
const hostHandlers = new WeakMap<object, HostHandlers>();
/** Dónde se escribió `[[` en cada editor (ahí se inserta el enlace elegido). */
const linkPositions = new WeakMap<object, number>();

const Shortcuts = Extension.create({
  name: 'lvShortcuts',
  // Antes que los de las extensiones (p. ej. Mod-Shift-h del resaltado sin color).
  priority: 1000,
  addKeyboardShortcuts() {
    const run = (s: EditorShortcut) => () => {
      hostHandlers.get(this.editor)?.shortcut(s);
      return true;
    };
    return {
      'Mod-z': run('undo'),
      'Mod-Shift-z': run('redo'),
      'Mod-y': run('redo'),
      'Mod-s': run('save'),
      'Alt-r': run('reading'),
      'Mod-Shift-e': () => this.editor.chain().focus().toggleMark('important').run(),
      'Mod-Shift-h': () =>
        this.editor
          .chain()
          .focus()
          .toggleHighlight({ color: styleVar('highlight', 'yellow') })
          .run(),
    };
  },
});

function formatState(editor: Editor): FormatState {
  return {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    important: editor.isActive('important'),
    textColor: tokenFromVar(
      'textColor',
      editor.getAttributes('textStyle').color,
    ) as TextColor | null,
    highlight: tokenFromVar(
      'highlight',
      editor.getAttributes('highlight').color,
    ) as HighlightColor | null,
    fontFamily: tokenFromVar(
      'fontFamily',
      editor.getAttributes('textStyle').fontFamily,
    ) as FontFamilyName | null,
    fontSize: tokenFromVar(
      'fontSize',
      editor.getAttributes('textStyle').fontSize,
    ) as FontSizeName | null,
    heading1: editor.isActive('heading', { level: 1 }),
    heading2: editor.isActive('heading', { level: 2 }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    blockquote: editor.isActive('blockquote'),
    code: editor.isActive('code'),
    imageSize: selectedImageSize(editor),
  };
}

function selectedImageSize(editor: Editor): ImageSize | null {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return null;
  return selection.node.type.name === INLINE_IMAGE_NODE ? sizeOf(selection.node.attrs.size) : null;
}

function applyFormat(editor: Editor, command: FormatAction) {
  const chain = editor.chain().focus();
  if (typeof command === 'object' && 'imageSize' in command) {
    return chain.updateAttributes(INLINE_IMAGE_NODE, { size: command.imageSize }).run();
  }
  if (typeof command === 'object') {
    const { style, value } = command;
    switch (style) {
      case 'textColor':
        return value ? chain.setColor(styleVar(style, value)).run() : chain.unsetColor().run();
      case 'highlight':
        return value
          ? chain.setHighlight({ color: styleVar(style, value) }).run()
          : chain.unsetHighlight().run();
      case 'fontFamily':
        return value && value !== 'sans'
          ? chain.setFontFamily(styleVar(style, value)).run()
          : chain.unsetFontFamily().run();
      case 'fontSize':
        return value && value !== 'normal'
          ? chain.setFontSize(styleVar(style, value)).run()
          : chain.unsetFontSize().run();
    }
  }
  switch (command) {
    case 'bold':
      return chain.toggleBold().run();
    case 'italic':
      return chain.toggleItalic().run();
    case 'underline':
      return chain.toggleUnderline().run();
    case 'strike':
      return chain.toggleStrike().run();
    case 'important':
      return chain.toggleMark('important').run();
    case 'heading1':
      return chain.toggleHeading({ level: 1 }).run();
    case 'heading2':
      return chain.toggleHeading({ level: 2 }).run();
    case 'bulletList':
      return chain.toggleBulletList().run();
    case 'orderedList':
      return chain.toggleOrderedList().run();
    case 'taskList':
      return chain.toggleTaskList().run();
    case 'blockquote':
      return chain.toggleBlockquote().run();
    case 'code':
      return chain.toggleCode().run();
    case 'clear':
      return chain.unsetAllMarks().clearNodes().run();
  }
}

function css(t: TipTapTheme) {
  return `
:root {
${styleVariables(t.scheme)}
--lv-important-fg: ${t.scheme === 'dark' ? '#FF7B72' : '#B42318'};
--lv-important-bg: ${t.scheme === 'dark' ? 'rgba(248, 81, 73, 0.18)' : '#FDE7E5'};
}
html, body { margin: 0; padding: 0; background: transparent; }
body { -webkit-text-size-adjust: 100%; }
.notas-editor { min-height: ${t.minHeight}px; cursor: text; }
.notas-editor .ProseMirror {
  min-height: ${t.minHeight}px;
  outline: none;
  color: ${t.text};
  caret-color: ${t.primary};
  font-family: ${t.fontFamily};
  font-size: ${t.fontSize}px;
  line-height: ${t.lineHeight}px;
  word-wrap: break-word;
  white-space: pre-wrap;
  -webkit-user-select: text;
  user-select: text;
}
.notas-editor .ProseMirror > * { margin: 0 0 ${Math.round(t.lineHeight / 3)}px; }
.notas-editor .ProseMirror > *:last-child { margin-bottom: 0; }
.notas-editor .ProseMirror p { margin: 0; }
.notas-editor .ProseMirror h1 { font-size: 1.5em; line-height: 1.25; margin-top: 0.6em; }
.notas-editor .ProseMirror h2 { font-size: 1.25em; line-height: 1.3; margin-top: 0.5em; }
.notas-editor .ProseMirror > h1:first-child, .notas-editor .ProseMirror > h2:first-child { margin-top: 0; }
.notas-editor .ProseMirror ul, .notas-editor .ProseMirror ol { padding-left: 1.4em; }
.notas-editor .ProseMirror li > p { margin: 0; }
.notas-editor .ProseMirror blockquote {
  border-left: 3px solid ${t.primary};
  margin-left: 0;
  padding-left: 0.8em;
  color: ${t.muted};
}
.notas-editor .ProseMirror code {
  background: ${t.codeBackground};
  border-radius: 4px;
  padding: 0.1em 0.3em;
  font-family: ui-monospace, Menlo, monospace;
  font-size: 0.9em;
}
.notas-editor .ProseMirror pre {
  background: ${t.codeBackground};
  border-radius: 8px;
  padding: 0.6em 0.8em;
  overflow-x: auto;
}
.notas-editor .ProseMirror pre code { background: none; padding: 0; }
.notas-editor .ProseMirror a { color: ${t.primary}; }
.notas-editor .ProseMirror mark { color: inherit; border-radius: 3px; padding: 0 0.1em; }
.notas-editor .ProseMirror img.lv-inline-image {
  display: block;
  max-width: 100%;
  height: auto;
  min-height: 48px;
  margin: 0.4em 0;
  border-radius: 10px;
  background: ${t.codeBackground};
}
.notas-editor .ProseMirror img.lv-inline-image[data-size="small"] { width: 35%; margin: 0.4em auto; }
.notas-editor .ProseMirror img.lv-inline-image[data-size="medium"] { width: 60%; margin: 0.4em auto; }
.notas-editor .ProseMirror img.lv-inline-image.ProseMirror-selectednode {
  outline: 3px solid ${t.primary};
}
.notas-editor .ProseMirror[contenteditable="false"] img.lv-inline-image { cursor: zoom-in; }
.notas-editor .ProseMirror .lv-note-link {
  color: ${t.text};
  text-decoration-color: ${t.primary};
  background: ${t.codeBackground};
  border-radius: 6px;
  padding: 0.05em 0.35em;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.notas-editor .ProseMirror .lv-note-link::before {
  content: "↗";
  display: inline-block;
  margin-right: 0.25em;
  color: ${t.primary};
}
.notas-editor .ProseMirror .lv-note-link.ProseMirror-selectednode { outline: 2px solid ${t.primary}; }
.notas-editor .ProseMirror .lv-important {
  color: var(--lv-important-fg);
  background: var(--lv-important-bg);
  font-weight: 700;
  border-radius: 4px;
  padding: 0 0.2em;
}
.notas-editor .ProseMirror hr { border: none; border-top: 1px solid ${t.muted}; margin: 1em 0; }
.notas-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0.2em; }
.notas-editor .ProseMirror ul[data-type="taskList"] li { display: flex; gap: 0.5em; align-items: flex-start; }
.notas-editor .ProseMirror ul[data-type="taskList"] li > label { flex: 0 0 auto; user-select: none; }
.notas-editor .ProseMirror ul[data-type="taskList"] li > label input {
  width: 1.05em; height: 1.05em; margin: 0.2em 0 0; accent-color: ${t.primary};
}
.notas-editor .ProseMirror ul[data-type="taskList"] li > div { flex: 1 1 auto; }
.notas-editor .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
  color: ${t.muted}; text-decoration: line-through;
}
.notas-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  color: ${t.muted};
  pointer-events: none;
}
`;
}
