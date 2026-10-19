import type { ComponentType } from 'react';

import type { EditorDoc } from './doc';

/**
 * Contrato del editor de contenido (PLAN.md, decisión 4). Hoy lo implementa un `TextInput`
 * de texto plano; en la fase 4, 10tap-editor/TipTap. Las pantallas solo dependen de esto.
 *
 * Es un componente controlado: `value` es la fuente de verdad (el historial deshacer/rehacer
 * vive fuera, en la pantalla).
 */
export type EditorAdapterProps = {
  value: EditorDoc;
  onChange: (doc: EditorDoc) => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Color del texto (el fondo lo pone la pantalla según el color de la nota). */
  textColor?: string;
};

export type EditorAdapter = ComponentType<EditorAdapterProps>;
