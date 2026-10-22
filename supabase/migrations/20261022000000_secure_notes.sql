-- Notas seguras (PLAN.md §10). Ejecutar una vez en el editor SQL de Supabase, después de las
-- anteriores. Es idempotente.
--
-- Las notas seguras viajan ya cifradas desde el dispositivo (AES-256-GCM con una clave que solo
-- se abre con la contraseña maestra): el servidor guarda texto cifrado que no puede leer. Solo
-- hay que admitir sus dos tablas en `sync_rows`.

alter table public.sync_rows drop constraint if exists sync_rows_tbl_check;
alter table public.sync_rows add constraint sync_rows_tbl_check check (
  tbl in (
    'folders', 'notes', 'checklist_items', 'tags', 'note_tags', 'reminders', 'attachments',
    'saved_filters', 'vaults', 'secure_notes'
  )
);
