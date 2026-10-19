import { useState } from 'react';

import type { Note } from '@/db/schema';
import { parseDoc, type EditorDoc } from '@/features/editor/doc';
import { createHistory, pushHistory, redoHistory, undoHistory } from '@/lib/history';

export type NoteDraft = { title: string; doc: EditorDoc };

/**
 * Borrador local del título y contenido de una nota, con deshacer/rehacer.
 * Se inicializa una sola vez con la nota: los cambios externos (color, anclar…) no lo tocan.
 */
export function useNoteDraft(note: Note) {
  const [history, setHistory] = useState(() =>
    createHistory<NoteDraft>({ title: note.title, doc: parseDoc(note.contentJson) }),
  );

  return {
    draft: history.present,
    setTitle: (title: string) => setHistory((h) => pushHistory(h, { ...h.present, title })),
    setDoc: (doc: EditorDoc) => setHistory((h) => pushHistory(h, { ...h.present, doc })),
    undo: () => setHistory(undoHistory),
    redo: () => setHistory(redoHistory),
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
