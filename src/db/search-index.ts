import { capabilities } from '@/lib/capabilities';

import type { Database } from './client';

/**
 * Índice de búsqueda FTS5 sobre título y texto de las notas, mantenido con triggers.
 * Va fuera de las migraciones de Drizzle porque el WASM de expo-sqlite en web no incluye FTS5
 * y la migración fallaría (PLAN.md §3.1). En web se busca con LIKE.
 * Todo es idempotente: se ejecuta en cada arranque.
 */
const CREATE_INDEX = `
CREATE VIRTUAL TABLE notes_fts USING fts5(
  note_id UNINDEXED,
  title,
  content_text,
  tokenize = 'unicode61 remove_diacritics 2'
);
INSERT INTO notes_fts (note_id, title, content_text) SELECT id, title, content_text FROM notes;
`;

const CREATE_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS notes_fts_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts (note_id, title, content_text) VALUES (new.id, new.title, new.content_text);
END;
CREATE TRIGGER IF NOT EXISTS notes_fts_ad AFTER DELETE ON notes BEGIN
  DELETE FROM notes_fts WHERE note_id = old.id;
END;
CREATE TRIGGER IF NOT EXISTS notes_fts_au AFTER UPDATE OF title, content_text ON notes BEGIN
  UPDATE notes_fts SET title = new.title, content_text = new.content_text WHERE note_id = old.id;
END;
`;

export async function ensureSearchIndex(db: Database): Promise<void> {
  if (!capabilities.fullTextSearch) return;
  const sqlite = db.$client;
  const existing = await sqlite.getFirstAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes_fts'",
  );
  await sqlite.withTransactionAsync(async () => {
    if (!existing) await sqlite.execAsync(CREATE_INDEX);
    await sqlite.execAsync(CREATE_TRIGGERS);
  });
}
