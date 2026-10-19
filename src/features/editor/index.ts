import { RichTextEditor } from './rich-text-editor';
import type { EditorAdapter, EditorCapabilities } from './types';

export * from './doc';
export * from './format';
export type { EditorAdapter, EditorAdapterProps, EditorHandle } from './types';

/**
 * Editor activo: TipTap (fase 4). El de texto plano (`PlainTextEditor`) sigue disponible tras la
 * misma interfaz por si hubiera que volver a él en alguna plataforma.
 */
export const Editor: EditorAdapter = RichTextEditor;
export const editorCapabilities: EditorCapabilities = { richText: true };
