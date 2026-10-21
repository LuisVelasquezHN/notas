/**
 * Web: los ficheros se descargan (no hay hoja de compartir con ficheros locales) y el PDF se genera
 * con el diálogo de impresión del navegador ("Guardar como PDF").
 */

export type TextFile = { name: string; mime: string; uti?: string; content: string };

export async function shareTextFile({ name, mime, content }: TextFile, _dialogTitle?: string) {
  const url = URL.createObjectURL(new Blob([content], { type: `${mime};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Tras la descarga ya no hace falta el blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Imprime el HTML en un iframe oculto: el navegador ofrece "Guardar como PDF". */
export async function sharePdf(html: string, _name: string, _dialogTitle?: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    frame.remove();
    throw new Error('Print frame unavailable');
  }
  doc.open();
  doc.write(html);
  doc.close();
  await Promise.all(
    Array.from(doc.images).map((img) => (img.complete ? null : img.decode().catch(() => null))),
  );
  win.focus();
  win.print();
  // `print()` bloquea hasta cerrar el diálogo en la mayoría de navegadores.
  setTimeout(() => frame.remove(), 1_000);
}

export const canShareText = typeof navigator !== 'undefined' && 'share' in navigator;

export async function shareText(text: string, title?: string) {
  await navigator.share({ text, title });
}
