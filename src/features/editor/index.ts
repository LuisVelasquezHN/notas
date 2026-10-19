import { PlainTextEditor } from './plain-text-editor';
import type { EditorAdapter } from './types';

export * from './doc';
export type { EditorAdapter, EditorAdapterProps } from './types';

/** Editor activo. En la fase 4 se sustituye por el adaptador de TipTap sin tocar las pantallas. */
export const Editor: EditorAdapter = PlainTextEditor;
