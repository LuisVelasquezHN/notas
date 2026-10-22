import { docToMarkdown } from '@/features/export/format';
import { shareTextFile } from '@/features/export/share';
import { currentLocale, t } from '@/i18n';
import { showSnackbar } from '@/stores/snackbar-store';

import { decryptAllSecureNotes } from './repository';

/**
 * Exporta las notas seguras en claro (Markdown). Solo se llega aquí con la bóveda abierta y
 * después de escribir la palabra de confirmación (`TypedConfirmSheet`).
 */
export async function exportSecureNotes() {
  try {
    const notes = await decryptAllSecureNotes();
    const now = new Date();
    const date = now.toLocaleString(currentLocale(), { dateStyle: 'long', timeStyle: 'short' });
    const body = notes
      .filter((n) => n.content)
      .map((n) => {
        const title = n.content!.title.trim() || t('vault.untitled');
        const text = docToMarkdown(n.content!.doc).trim();
        return `# ${title}\n\n${text}`;
      })
      .join('\n\n---\n\n');
    const pad = (n: number) => String(n).padStart(2, '0');
    await shareTextFile(
      {
        name: `notas-seguras-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.md`,
        mime: 'text/markdown',
        uti: 'net.daringfireball.markdown',
        content: `> ${t('vault.exportHeader', { date })}\n\n${body}\n`,
      },
      t('vault.export'),
    );
    showSnackbar(t('vault.exported'));
  } catch (e) {
    console.warn('Bóveda: error al exportar', e);
    showSnackbar(t('vault.exportFailed'));
  }
}
