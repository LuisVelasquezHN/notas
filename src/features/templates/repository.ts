import { getDb } from '@/db/client';
import { checklistItems, type NewNote } from '@/db/schema';
import { docToText, serializeDoc } from '@/features/editor/doc';
import { createNote } from '@/features/notes/repository';
import { uuidv7 } from '@/lib/ids';
import { sortKeysBetween } from '@/lib/sort-key';

import type { NoteTemplate } from './templates';

/** Crea una nota con el contenido de la plantilla (y los campos de la pantalla: carpeta…). */
export async function createNoteFromTemplate(
  template: NoteTemplate,
  fields: Partial<Pick<NewNote, 'folderId' | 'isFavorite'>> = {},
  now: Date = new Date(),
) {
  const content = template.build(now);
  if (content.type === 'text') {
    return createNote('text', {
      ...fields,
      title: content.title,
      contentJson: serializeDoc(content.doc),
      contentText: docToText(content.doc),
    });
  }

  const note = await createNote('checklist', {
    ...fields,
    title: content.title,
    contentText: content.items.join('\n'),
  });
  if (content.items.length > 0) {
    const keys = sortKeysBetween(null, null, content.items.length);
    const at = now.getTime();
    await getDb()
      .insert(checklistItems)
      .values(
        content.items.map((text, i) => ({
          id: uuidv7(at),
          noteId: note.id,
          text,
          sortKey: keys[i],
          createdAt: at,
          updatedAt: at,
        })),
      );
  }
  return note;
}
