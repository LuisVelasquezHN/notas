import type { ComponentType, Ref } from 'react';

import type { EditorDoc } from './doc';
import type { FormatAction, FormatState } from './format';

/** Acciones que la pantalla puede pedir al editor (barra de formato). */
export type EditorHandle = {
  format: (command: FormatAction) => void;
  focus: () => void;
  /** Inserta texto en el cursor (p. ej. una contraseña generada). Solo el editor enriquecido. */
  insertText?: (text: string) => void;
  /** Entrega el texto seleccionado por `onSelectionText`. Solo el editor enriquecido. */
  requestSelection?: () => void;
  /** Inserta en el cursor imágenes del texto (ids de adjuntos `inline`). */
  insertImages?: (ids: string[]) => void;
  /** Inserta en el cursor un enlace a otra nota (tras `onLinkRequest`). */
  insertNoteLink?: (id: string, title: string) => void;
};

export type EditorShortcut = 'undo' | 'redo' | 'save' | 'reading';
export type DroppedImage = { dataUri: string; width: number; height: number };

/**
 * Contrato del editor de contenido (PLAN.md, decisión 4). Lo implementa TipTap (fase 4); el
 * editor de texto plano del MVP sigue disponible tras la misma interfaz. Las pantallas solo
 * dependen de esto.
 *
 * Es un componente controlado: `value` es la fuente de verdad (el historial deshacer/rehacer
 * vive fuera, en la pantalla).
 */
export type EditorAdapterProps = {
  ref?: Ref<EditorHandle>;
  value: EditorDoc;
  onChange: (doc: EditorDoc) => void;
  editable?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Color del texto (el fondo lo pone la pantalla según el color de la nota). */
  textColor?: string;
  /** Formatos activos en la selección (para resaltar la barra de formato). */
  onFormatChange?: (state: FormatState) => void;
  onFocusChange?: (focused: boolean) => void;
  /** Parte inferior del cursor, en px desde el borde superior del editor. */
  onCaret?: (bottom: number) => void;
  /** Respuesta a `requestSelection` (cadena vacía si no hay nada seleccionado). */
  onSelectionText?: (text: string) => void;
  /**
   * Alto máximo del editor (iOS/Android): con más contenido, el editor se desplaza por dentro en
   * vez de crecer (normalmente, el alto visible de la pantalla).
   */
  maxHeight?: number;
  /** Contenido de las imágenes del texto: `id del adjunto → URI` (data URI en iOS/Android). */
  images?: Record<string, string>;
  /** Atajos de teclado que gestiona la pantalla (deshacer, rehacer, guardar). */
  onShortcut?: (shortcut: EditorShortcut) => void;
  /** Imágenes pegadas o soltadas en el editor. */
  onImageFiles?: (images: DroppedImage[]) => void;
  /** Abrir una imagen del texto a pantalla completa. */
  onOpenImage?: (id: string) => void;
  /** Tocar un enlace a otra nota. */
  onOpenNote?: (id: string) => void;
  /** Se ha escrito `[[`: elegir la nota que enlazar. */
  onLinkRequest?: () => void;
};

export type EditorAdapter = ComponentType<EditorAdapterProps>;

/** Si el editor activo admite formato (el de texto plano, no). */
export type EditorCapabilities = { richText: boolean };
