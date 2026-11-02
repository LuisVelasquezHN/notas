import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect, useState } from 'react';

import { inlineImagesQuery } from '../repository';
import { readFileBase64 } from '../storage';

/** Data URI de cada imagen ya leída (el contenido de un adjunto no cambia). */
const cache = new Map<string, string>();

/**
 * Contenido de las imágenes del texto de una nota para el editor (`id → URI`). En web ya son data
 * URI; en iOS/Android se leen del fichero en base64, porque el editor vive en una webview.
 */
export function useInlineImageSources(noteId: string): Record<string, string> {
  const { data: rows } = useLiveQuery(inlineImagesQuery(noteId), [noteId]);
  const [sources, setSources] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = {};
      for (const row of rows) {
        if (row.localUri.startsWith('data:')) {
          next[row.id] = row.localUri;
          continue;
        }
        let src = cache.get(row.id);
        if (!src) {
          try {
            src = `data:${row.mime ?? 'image/jpeg'};base64,${await readFileBase64(row.localUri)}`;
            cache.set(row.id, src);
          } catch (e) {
            // Aún sin descargar de la nube o fichero perdido: el editor muestra un hueco.
            console.warn('Imagen del texto no disponible', e);
            continue;
          }
        }
        next[row.id] = src;
      }
      if (!cancelled) setSources(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  return sources;
}
