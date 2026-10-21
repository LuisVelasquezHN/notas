import type { Note } from '@/db/schema';
import { noteAttachmentsQuery } from '@/features/attachments/repository';
import { readFileBase64 } from '@/features/attachments/storage';
import { checklistItemsQuery } from '@/features/checklist/repository';
import { parseDoc } from '@/features/editor/doc';
import { unlockNote } from '@/features/security/actions';
import { tagsForNoteQuery } from '@/features/tags/repository';
import { currentLocale, t } from '@/i18n';
import { showSnackbar } from '@/stores/snackbar-store';

import {
  exportFileName,
  noteToHtml,
  noteToMarkdown,
  noteToPlainText,
  type ExportNote,
} from './format';
import { sharePdf, shareText, shareTextFile } from './share';

export type ExportFormat = 'share' | 'markdown' | 'text' | 'pdf';

/** Reúne lo necesario para exportar una nota (las imágenes, solo para el PDF). */
async function collect(note: Note, withImages: boolean): Promise<ExportNote> {
  const tags = (await tagsForNoteQuery(note.id)).map((tag) => tag.name);
  const items =
    note.type === 'checklist'
      ? (await checklistItemsQuery(note.id)).map(({ text, isChecked, indent }) => ({
          text,
          isChecked,
          indent,
        }))
      : undefined;
  let images: string[] | undefined;
  if (withImages) {
    const attachments = (await noteAttachmentsQuery(note.id)).filter((a) => a.kind === 'image');
    images = await Promise.all(
      attachments.map(
        async (a) => `data:${a.mime ?? 'image/jpeg'};base64,${await readFileBase64(a.localUri)}`,
      ),
    );
  }
  return {
    title: note.title,
    doc: note.type === 'text' ? parseDoc(note.contentJson) : undefined,
    items,
    tags,
    images,
  };
}

/**
 * Exporta o comparte una nota. Una nota bloqueada pide verificación antes (el contenido sale de la
 * app). En iOS y Android abre la hoja de compartir; en web descarga el fichero o imprime el PDF.
 */
export async function exportNote(note: Note, format: ExportFormat) {
  if (!(await unlockNote(note))) return;
  const fallback = t('export.fileFallback');
  try {
    const data = await collect(note, format === 'pdf');
    switch (format) {
      case 'share':
        await shareText(noteToPlainText(data), note.title || undefined);
        return;
      case 'markdown':
        await shareTextFile(
          {
            name: exportFileName(note.title, 'md', fallback),
            mime: 'text/markdown',
            uti: 'net.daringfireball.markdown',
            content: noteToMarkdown(data),
          },
          t('export.dialogTitle'),
        );
        return;
      case 'text':
        await shareTextFile(
          {
            name: exportFileName(note.title, 'txt', fallback),
            mime: 'text/plain',
            uti: 'public.plain-text',
            content: noteToPlainText(data),
          },
          t('export.dialogTitle'),
        );
        return;
      case 'pdf':
        await sharePdf(
          noteToHtml(data, currentLocale()),
          exportFileName(note.title, 'pdf', fallback),
          t('export.dialogTitle'),
        );
        return;
    }
  } catch (e) {
    // Cerrar la hoja de compartir en web lanza `AbortError`: no es un fallo.
    if (e instanceof Error && e.name === 'AbortError') return;
    console.warn('Exportar: error', e);
    showSnackbar(t('export.failed'));
  }
}
