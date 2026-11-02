// Publica un APK como release de GitHub para que el enlace fijo
//   https://github.com/<repo>/releases/latest/download/lv-notes.apk
// lleve siempre al último. Lo usa el workflow de EAS (.eas/workflows/android-preview.yml).
//
// Uso: node scripts/publish-apk-release.mjs <ruta-del-apk>
// Variables: GITHUB_RELEASES_TOKEN (token con permiso "Contents: read and write" en el repo),
//            GITHUB_REPOSITORY (opcional, por defecto LuisVelasquezHN/notas).
import { readFile, stat } from 'node:fs/promises';

const ASSET_NAME = 'lv-notes.apk';
const TAG_PREFIX = 'android-';
/** Releases de Android que se conservan (los demás se borran para no acumular APK). */
const KEEP = 3;

const [apkPath] = process.argv.slice(2);
const token = process.env.GITHUB_RELEASES_TOKEN;
const repo = process.env.GITHUB_REPOSITORY || 'LuisVelasquezHN/notas';
const API = process.env.GITHUB_API_URL || 'https://api.github.com';
if (!apkPath || !token) {
  console.error('Falta la ruta del APK o GITHUB_RELEASES_TOKEN');
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
  });
  if (!res.ok)
    throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
};

const now = new Date();
const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const tag = `${TAG_PREFIX}${stamp}`;
const buildId = process.env.EAS_BUILD_ID_FOR_RELEASE ?? '';

const release = await api(`/repos/${repo}/releases`, {
  method: 'POST',
  body: JSON.stringify({
    tag_name: tag,
    target_commitish: 'main',
    name: `LV Notes Android (${now.toISOString().slice(0, 10)})`,
    body: `APK de prueba compilado con EAS${buildId ? ` (build ${buildId})` : ''}.\n\nDescarga directa: https://github.com/${repo}/releases/latest/download/${ASSET_NAME}`,
    make_latest: 'true',
  }),
});

const { size } = await stat(apkPath);
const uploadUrl = release.upload_url.replace(/\{.*\}$/, '');
await api(`${uploadUrl}?name=${ASSET_NAME}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/vnd.android.package-archive',
    'Content-Length': String(size),
  },
  body: await readFile(apkPath),
});
console.log(`Publicado ${tag}: https://github.com/${repo}/releases/latest/download/${ASSET_NAME}`);

// Limpieza: se conservan los últimos releases de Android.
const releases = await api(`/repos/${repo}/releases?per_page=100`);
const old = releases
  .filter((r) => r.tag_name.startsWith(TAG_PREFIX))
  .sort((a, b) => b.created_at.localeCompare(a.created_at))
  .slice(KEEP);
for (const r of old) {
  await api(`/repos/${repo}/releases/${r.id}`, { method: 'DELETE' });
  await api(`/repos/${repo}/git/refs/tags/${r.tag_name}`, { method: 'DELETE' }).catch(() => null);
  console.log(`Borrado el release antiguo ${r.tag_name}`);
}
