'use dom';

import { Mark, mergeAttributes } from '@tiptap/core';
import { Highlight } from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Color, FontFamily, FontSize, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extensions';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { useDOMImperativeHandle, type DOMImperativeFactory, type DOMProps } from 'expo/dom';
import { useEffect, useRef, type Ref } from 'react';

import type { EditorDoc } from '../doc';
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
  requestSelection: () => void;
}

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
};

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
  });
  useEffect(() => {
    callbacks.current = {
      onChange,
      onFormatChange,
      onFocusChange,
      onCaret,
      onSelectionText,
      onHeight,
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
      insertText: (text: JSONValue) => {
        // Como nodo de texto: con una cadena, TipTap la interpretaría como HTML.
        if (editor && typeof text === 'string' && text) {
          editor.chain().focus().insertContent({ type: 'text', text }).run();
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
  };
}

function applyFormat(editor: Editor, command: FormatAction) {
  const chain = editor.chain().focus();
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
