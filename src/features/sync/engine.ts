import { and, asc, eq, inArray, like, sql } from 'drizzle-orm';
import Storage from 'expo-sqlite/kv-store';

import { getDb } from '@/db/client';
import { noteTags, savedFilters, syncOutbox, syncState, tags } from '@/db/schema';
import { parseFilter, serializeFilter } from '@/features/filters/filter';

import { downloadAttachment, uploadAttachment } from './files';
import {
  planPull,
  rowIdOf,
  rowKey,
  toRemoteData,
  versionOf,
  type LocalSnapshot,
  type PullPlan,
  type RemoteChange,
  type Row,
} from './plan';
import { getSupabase } from './supabase';
import { enqueueAll } from './tracking';
import { SYNC_TABLES, splitNoteTagId, tableKeyFromName, type SyncTableKey } from './tables';
import { useSyncStore } from './store';

/**
 * Sincronización con Supabase (PLAN.md §9). Cada pasada:
 * 1. baja lo que cambió en el servidor desde la última vez (`seq` > cursor) y lo aplica con
 *    `planPull` (gana lo más reciente; los cambios locales pendientes más nuevos se respetan);
 * 2. sube los cambios locales pendientes (`sync_outbox`) con `push_changes`, que solo sustituye
 *    lo que es igual o más reciente; antes, los ficheros de los adjuntos nuevos.
 * Las pasadas no se solapan: si se pide otra mientras corre una, se hace una más al terminar.
 */

const PAGE_SIZE = 1000;
const PUSH_BATCH = 200;
const ID_CHUNK = 500;

const kv = {
  user: 'sync.userId',
  cursor: (userId: string) => `sync.cursor.${userId}`,
  lastSync: (userId: string) => `sync.lastSyncedAt.${userId}`,
};

export function lastSyncedAt(userId: string): number | null {
  const value = Storage.getItemSync(kv.lastSync(userId));
  return value ? Number(value) : null;
}

let running: Promise<void> | null = null;
let again = false;

/** Sincroniza ahora (si hay sesión). Los errores quedan en el estado (`useSyncStore`). */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function syncOnce() {
  const { data } = await getSupabase().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return;
  const store = useSyncStore.getState();
  store.setStatus('syncing');
  try {
    await prepareAccount(userId);
    await pull(userId);
    await push(userId);
    const now = Date.now();
    Storage.setItemSync(kv.lastSync(userId), String(now));
    useSyncStore.getState().setStatus('idle', now);
  } catch (e) {
    console.warn('Sync: error', e);
    useSyncStore.getState().setStatus('error');
  }
}

/** ¿Hay cambios locales sin subir? */
export async function hasPendingChanges(): Promise<boolean> {
  const [row] = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(syncOutbox);
  return Number(row?.count ?? 0) > 0;
}

/** Olvida el estado de sincronización de una cuenta eliminada. */
export function forgetAccount(userId: string) {
  Storage.removeItemSync(kv.cursor(userId));
  Storage.removeItemSync(kv.lastSync(userId));
  if (Storage.getItemSync(kv.user) === userId) Storage.removeItemSync(kv.user);
}

/** Sincroniza solo si hay cambios locales sin subir (tras editar, al salir de la app). */
export async function syncIfPending(): Promise<void> {
  if (await hasPendingChanges()) await syncNow();
}

/**
 * Primera pasada con una cuenta (o con otra distinta de la anterior): todo lo que hay en el
 * dispositivo se apunta para subir y se baja la cuenta entera.
 */
async function prepareAccount(userId: string) {
  if (Storage.getItemSync(kv.user) === userId) return;
  await enqueueAll(getDb());
  Storage.setItemSync(kv.cursor(userId), '0');
  Storage.setItemSync(kv.user, userId);
}

// ---------------------------------------------------------------------------------------------
// Bajar

type RemoteRow = {
  tbl: string;
  row_id: string;
  updated_at: number;
  deleted: boolean;
  data: Record<string, unknown> | null;
  seq: number;
};

async function pull(userId: string) {
  let cursor = Number(Storage.getItemSync(kv.cursor(userId)) ?? 0);
  const changes: RemoteChange[] = [];
  // Se baja todo antes de aplicar: una fila puede apuntar a otra que llega en una página posterior.
  for (;;) {
    const { data, error } = await getSupabase()
      .from('sync_rows')
      .select('tbl, row_id, updated_at, deleted, data, seq')
      .gt('seq', cursor)
      .order('seq', { ascending: true })
      .limit(PAGE_SIZE);
    if (error) throw error;
    const rows = data as RemoteRow[];
    for (const r of rows) {
      changes.push({
        tbl: r.tbl,
        rowId: r.row_id,
        updatedAt: Number(r.updated_at),
        deleted: r.deleted,
        data: r.data,
        seq: Number(r.seq),
      });
    }
    if (rows.length > 0) cursor = Number(rows[rows.length - 1].seq);
    if (rows.length < PAGE_SIZE) break;
  }
  if (changes.length === 0) return;

  const plan = planPull(changes, await loadSnapshot(changes));
  await downloadFiles(plan, userId);
  applyPlan(plan);
  Storage.setItemSync(kv.cursor(userId), String(cursor));
}

function chunks<T>(items: T[], size = ID_CHUNK): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Filas locales con estos ids (en `note_tags`, ids `note|tag`). */
async function loadRows(key: SyncTableKey, rowIds: string[]): Promise<Row[]> {
  const db = getDb();
  const rows: Row[] = [];
  if (key === 'noteTags') {
    const wanted = new Set(rowIds);
    const noteIds = [...new Set(rowIds.map((id) => splitNoteTagId(id)?.noteId ?? ''))];
    for (const ids of chunks(noteIds)) {
      const pairs = await db.select().from(noteTags).where(inArray(noteTags.noteId, ids));
      rows.push(...pairs.filter((p) => wanted.has(rowIdOf('noteTags', p))));
    }
    return rows;
  }
  const table = SYNC_TABLES[key].table as typeof tags;
  for (const ids of chunks(rowIds)) {
    rows.push(...(await db.select().from(table).where(inArray(table.id, ids))));
  }
  return rows;
}

async function allIds(key: 'folders' | 'notes' | 'checklistItems' | 'tags') {
  const table = SYNC_TABLES[key].table as typeof tags;
  const rows = await getDb().select({ id: table.id }).from(table);
  return new Set(rows.map((r) => r.id));
}

async function loadSnapshot(changes: RemoteChange[]): Promise<LocalSnapshot> {
  const byTable = new Map<SyncTableKey, string[]>();
  for (const change of changes) {
    const key = tableKeyFromName(change.tbl);
    if (key) byTable.set(key, [...(byTable.get(key) ?? []), change.rowId]);
  }
  const rows = new Map<string, Row>();
  for (const [key, ids] of byTable) {
    for (const row of await loadRows(key, [...new Set(ids)])) {
      rows.set(rowKey(SYNC_TABLES[key].name, rowIdOf(key, row)), row);
    }
  }
  const pending = new Map(
    (await getDb().select().from(syncOutbox)).map((e) => [
      rowKey(e.tbl, e.rowId),
      { changedAt: e.changedAt, deleted: e.deleted },
    ]),
  );
  return {
    ids: {
      folders: await allIds('folders'),
      notes: await allIds('notes'),
      checklistItems: await allIds('checklistItems'),
      tags: await allIds('tags'),
    },
    rows,
    pending,
    tags: await getDb().select({ id: tags.id, name: tags.name }).from(tags),
  };
}

/**
 * Descarga los ficheros de los adjuntos nuevos. Los que no están en el servidor (o están en la
 * papelera y no se tenían aquí) no se aplican.
 */
async function downloadFiles(plan: PullPlan, userId: string) {
  const keep: PullPlan['upserts'] = [];
  for (const upsert of plan.upserts) {
    if (upsert.key === 'attachments' && upsert.row.localUri === '') {
      if (upsert.row.deletedAt != null) continue;
      const localUri = await downloadAttachment(userId, {
        id: String(upsert.row.id),
        mime: (upsert.row.mime as string | null) ?? null,
      });
      if (!localUri) continue;
      upsert.row = { ...upsert.row, localUri };
    }
    keep.push(upsert);
  }
  plan.upserts = keep;
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

function setApplying(tx: Tx, applying: boolean) {
  tx.update(syncState).set({ applying }).where(eq(syncState.id, 1)).run();
}

/** Aplica el plan en una transacción. Solo se apunta para subir lo que el plan marca. */
function applyPlan(plan: PullPlan) {
  getDb().transaction((tx) => {
    // 1. Etiquetas locales que se funden: se apartan de su nombre (único) para dejar sitio.
    for (const { from } of plan.tagMerges) {
      tx.update(tags)
        .set({ name: sql`${tags.name} || ' · ' || ${tags.id}` })
        .where(eq(tags.id, from))
        .run();
    }

    setApplying(tx, true);
    for (const { tbl, rowId } of plan.dropPending) {
      tx.delete(syncOutbox)
        .where(and(eq(syncOutbox.tbl, tbl), eq(syncOutbox.rowId, rowId)))
        .run();
    }
    // 2. Borrados (primero lo que apunta a otras filas) y luego altas y cambios, en orden.
    for (const { key, rowId } of plan.deletes) {
      if (key === 'noteTags') {
        const pair = splitNoteTagId(rowId);
        if (pair) {
          tx.delete(noteTags)
            .where(and(eq(noteTags.noteId, pair.noteId), eq(noteTags.tagId, pair.tagId)))
            .run();
        }
      } else {
        const table = SYNC_TABLES[key].table as typeof tags;
        tx.delete(table).where(eq(table.id, rowId)).run();
      }
    }
    for (const { key, row, track } of plan.upserts) {
      if (track) setApplying(tx, false);
      if (key === 'noteTags') {
        tx.insert(noteTags)
          .values(row as never)
          .onConflictDoNothing()
          .run();
      } else {
        const table = SYNC_TABLES[key].table as typeof tags;
        tx.insert(table)
          .values(row as never)
          .onConflictDoUpdate({ target: table.id, set: row as never })
          .run();
      }
      if (track) setApplying(tx, true);
    }
    setApplying(tx, false);

    // 3. Fusiones de etiquetas (se suben): las notas y carpetas inteligentes pasan a la que gana.
    for (const { from, to } of plan.tagMerges) {
      tx.run(sql`INSERT OR IGNORE INTO note_tags (note_id, tag_id, created_at)
        SELECT note_id, ${to}, created_at FROM note_tags WHERE tag_id = ${from}`);
      const filters = tx
        .select()
        .from(savedFilters)
        .where(like(savedFilters.queryJson, `%${from}%`))
        .all();
      for (const f of filters) {
        const filter = parseFilter(f.queryJson);
        if (!filter.tagIds?.includes(from)) continue;
        const tagIds = [...new Set(filter.tagIds.map((id) => (id === from ? to : id)))];
        tx.update(savedFilters)
          .set({ queryJson: serializeFilter({ ...filter, tagIds }), updatedAt: Date.now() })
          .where(eq(savedFilters.id, f.id))
          .run();
      }
      tx.delete(tags).where(eq(tags.id, from)).run();
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Subir

type PushChange = {
  tbl: string;
  row_id: string;
  updated_at: number;
  deleted: boolean;
  data: Row | null;
};

async function push(userId: string) {
  const db = getDb();
  for (;;) {
    const entries = await db
      .select()
      .from(syncOutbox)
      .orderBy(asc(syncOutbox.changedAt))
      .limit(PUSH_BATCH);
    if (entries.length === 0) return;

    const byTable = new Map<SyncTableKey, string[]>();
    for (const e of entries) {
      const key = tableKeyFromName(e.tbl);
      if (key && !e.deleted) byTable.set(key, [...(byTable.get(key) ?? []), e.rowId]);
    }
    const rows = new Map<string, Row>();
    for (const [key, ids] of byTable) {
      for (const row of await loadRows(key, ids)) {
        rows.set(rowKey(SYNC_TABLES[key].name, rowIdOf(key, row)), row);
      }
    }

    const changes: PushChange[] = [];
    for (const e of entries) {
      const key = tableKeyFromName(e.tbl);
      if (!key) continue;
      const row = e.deleted ? undefined : rows.get(rowKey(e.tbl, e.rowId));
      if (!row) {
        changes.push({
          tbl: e.tbl,
          row_id: e.rowId,
          updated_at: e.changedAt,
          deleted: true,
          data: null,
        });
        continue;
      }
      if (key === 'attachments' && row.deletedAt == null) {
        await uploadAttachment(userId, {
          id: String(row.id),
          localUri: String(row.localUri),
          mime: (row.mime as string | null) ?? null,
        });
      }
      changes.push({
        tbl: e.tbl,
        row_id: e.rowId,
        updated_at: versionOf(key, row),
        deleted: false,
        data: toRemoteData(key, row),
      });
    }

    const { error } = await getSupabase().rpc('push_changes', { changes });
    if (error) throw error;

    // Solo se quita lo subido: si la fila cambió mientras tanto, `changed_at` ya es otro.
    db.transaction((tx) => {
      for (const e of entries) {
        tx.delete(syncOutbox)
          .where(
            and(
              eq(syncOutbox.tbl, e.tbl),
              eq(syncOutbox.rowId, e.rowId),
              eq(syncOutbox.changedAt, e.changedAt),
            ),
          )
          .run();
      }
    });
    if (entries.length < PUSH_BATCH) return;
  }
}
