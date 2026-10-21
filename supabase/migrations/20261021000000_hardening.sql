-- Refuerzo de seguridad (revisión del 21-10-2026). Ejecutar una vez en el editor SQL de Supabase,
-- después de 20261020000000_sync.sql. Es idempotente.
--
-- Las políticas RLS ya impiden leer o escribir datos de otra cuenta. Esto limita lo que una cuenta
-- puede guardar en la suya, para que nadie llene la base de datos ni el almacenamiento del plan
-- gratuito (ni suba ficheros que no sean imágenes o audio).

-- Solo las tablas que sincroniza la app, ids razonables y filas de como mucho 1 MB.
alter table public.sync_rows drop constraint if exists sync_rows_tbl_check;
alter table public.sync_rows add constraint sync_rows_tbl_check check (
  tbl in ('folders', 'notes', 'checklist_items', 'tags', 'note_tags', 'reminders', 'attachments', 'saved_filters')
);

alter table public.sync_rows drop constraint if exists sync_rows_row_id_check;
alter table public.sync_rows add constraint sync_rows_row_id_check check (
  row_id ~ '^[A-Za-z0-9_-]{1,64}(\|[A-Za-z0-9_-]{1,64})?$'
);

alter table public.sync_rows drop constraint if exists sync_rows_data_size_check;
alter table public.sync_rows add constraint sync_rows_data_size_check check (
  data is null or octet_length(data::text) <= 1048576
);

-- Límite de filas por cuenta (unas 50 000: de sobra para notas, ítems, etiquetas…).
create or replace function public.sync_rows_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.sync_rows where user_id = new.user_id) >= 50000 then
    raise exception 'sync_rows: límite de filas por cuenta alcanzado';
  end if;
  return new;
end;
$$;

drop trigger if exists sync_rows_limit on public.sync_rows;
create trigger sync_rows_limit before insert on public.sync_rows
  for each row execute function public.sync_rows_limit();

-- Ficheros: como mucho 25 MB, solo imágenes y audio.
update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array['image/*', 'audio/*']
where id = 'attachments';
