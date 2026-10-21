const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/3gpp': '3gp',
};

/** Extensión del fichero guardado: por el tipo MIME o, si no hay, por la URI de origen. */
export function fileExtension(mime: string | null | undefined, uri: string): string {
  const fromMime = mime ? EXTENSIONS[mime.toLowerCase().split(';')[0].trim()] : undefined;
  if (fromMime) return fromMime;
  const match = /\.([a-z0-9]{2,5})(?:[?#].*)?$/i.exec(uri);
  return match ? match[1].toLowerCase() : 'bin';
}

/** "1:05" · "12:30" · "1:02:03". */
export function formatDuration(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
