import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

import type { NoteColor } from '@/theme/tokens';

/**
 * Convenciones (ver PLAN.md §4):
 * - IDs UUID v7 generados en el cliente.
 * - Fechas: INTEGER, milisegundos UTC.
 * - Borrado lógico con `deleted_at` + `updated_at` en todo: listo para sincronizar en el futuro.
 * - `sort_key`: fractional indexing para el orden manual.
 * - Colores guardados como token (`NoteColor`), no como hex.
 */

const timestamps = {
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

const bool = (name: string) => integer(name, { mode: 'boolean' }).notNull().default(false);

export const NOTE_TYPES = ['text', 'checklist', 'image', 'audio'] as const;
export type NoteType = (typeof NOTE_TYPES)[number];

export const REMINDER_STATUSES = ['scheduled', 'fired', 'done', 'snoozed'] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const ATTACHMENT_KINDS = ['image', 'audio', 'file'] as const;
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

export const folders = sqliteTable(
  'folders',
  {
    id: text('id').primaryKey(),
    parentId: text('parent_id').references((): AnySQLiteColumn => folders.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    color: text('color').$type<NoteColor>().notNull().default('default'),
    icon: text('icon'),
    sortKey: text('sort_key').notNull(),
    ...timestamps,
  },
  (t) => [index('folders_parent_idx').on(t.parentId, t.sortKey)],
);

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    type: text('type', { enum: NOTE_TYPES }).notNull().default('text'),
    title: text('title').notNull().default(''),
    /** Documento ProseMirror/TipTap serializado (ver PLAN.md, decisión 4). */
    contentJson: text('content_json'),
    /** Texto plano derivado: vista previa y búsqueda. */
    contentText: text('content_text').notNull().default(''),
    folderId: text('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    color: text('color').$type<NoteColor>().notNull().default('default'),
    isPinned: bool('is_pinned'),
    pinnedAt: integer('pinned_at'),
    isArchived: bool('is_archived'),
    isFavorite: bool('is_favorite'),
    isLocked: bool('is_locked'),
    sortKey: text('sort_key').notNull(),
    ...timestamps,
  },
  (t) => [
    index('notes_list_idx').on(t.deletedAt, t.isArchived, t.isPinned, t.updatedAt),
    index('notes_folder_idx').on(t.folderId),
  ],
);

export const checklistItems = sqliteTable(
  'checklist_items',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    text: text('text').notNull().default(''),
    isChecked: bool('is_checked'),
    checkedAt: integer('checked_at'),
    indent: integer('indent').notNull().default(0),
    dueAt: integer('due_at'),
    sortKey: text('sort_key').notNull(),
    ...timestamps,
  },
  (t) => [index('checklist_items_note_idx').on(t.noteId, t.sortKey)],
);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').$type<NoteColor>().notNull().default('default'),
  ...timestamps,
});

export const noteTags = sqliteTable(
  'note_tags',
  {
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.noteId, t.tagId] }), index('note_tags_tag_idx').on(t.tagId)],
);

export const reminders = sqliteTable(
  'reminders',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    checklistItemId: text('checklist_item_id').references(() => checklistItems.id, {
      onDelete: 'cascade',
    }),
    fireAt: integer('fire_at').notNull(),
    /** Regla RFC 5545 (RRULE) para recordatorios recurrentes. */
    rrule: text('rrule'),
    /** Zona IANA, p. ej. "Europe/Madrid": mantiene la hora local en viajes y cambios de horario. */
    timezone: text('timezone').notNull(),
    status: text('status', { enum: REMINDER_STATUSES }).notNull().default('scheduled'),
    osNotificationId: text('os_notification_id'),
    ...timestamps,
  },
  (t) => [
    index('reminders_fire_idx').on(t.status, t.fireAt),
    index('reminders_note_idx').on(t.noteId),
  ],
);

export const attachments = sqliteTable(
  'attachments',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ATTACHMENT_KINDS }).notNull(),
    localUri: text('local_uri').notNull(),
    mime: text('mime'),
    size: integer('size'),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    sortKey: text('sort_key').notNull(),
    ...timestamps,
  },
  (t) => [index('attachments_note_idx').on(t.noteId)],
);

export const noteVersions = sqliteTable(
  'note_versions',
  {
    id: text('id').primaryKey(),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    contentJson: text('content_json'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('note_versions_note_idx').on(t.noteId, t.createdAt)],
);

export const savedFilters = sqliteTable('saved_filters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  icon: text('icon'),
  /** `NoteFilter` serializado (se define en la fase 2). */
  queryJson: text('query_json').notNull(),
  sortKey: text('sort_key').notNull(),
  ...timestamps,
});

export type Folder = typeof folders.$inferSelect;
export type NewFolder = typeof folders.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type ChecklistItem = typeof checklistItems.$inferSelect;
export type NewChecklistItem = typeof checklistItems.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type NoteVersion = typeof noteVersions.$inferSelect;
export type SavedFilter = typeof savedFilters.$inferSelect;
