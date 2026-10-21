-- Sincronización de Notas (PLAN.md §9). Ejecutar una vez en el editor SQL de Supabase.
--
-- Cada fila de la app (nota, carpeta, ítem…) se guarda como JSON en `sync_rows`, una por
-- (usuario, tabla, id). Gana la versión más reciente (`updated_at`, ms UTC del cliente). Las
-- filas borradas del todo quedan como lápida (`deleted = true`, sin datos) para que el borrado
-- llegue al resto de dispositivos. `seq` crece con cada escritura: cada dispositivo pide lo que
-- tenga un `seq` mayor que el último que vio.

create sequence if not exists public.sync_seq;

create table if not exists public.sync_rows (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl text not null,
  row_id text not null,
  updated_at bigint not null,
  deleted boolean not null default false,
  data jsonb,
  seq bigint not null default nextval('public.sync_seq'),
  primary key (user_id, tbl, row_id)
);

create index if not exists sync_rows_pull_idx on public.sync_rows (user_id, seq);

alter table public.sync_rows enable row level security;

drop policy if exists "sync_rows: leer las propias" on public.sync_rows;
create policy "sync_rows: leer las propias" on public.sync_rows
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "sync_rows: crear las propias" on public.sync_rows;
create policy "sync_rows: crear las propias" on public.sync_rows
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "sync_rows: cambiar las propias" on public.sync_rows;
create policy "sync_rows: cambiar las propias" on public.sync_rows
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Sube cambios: `changes` es un array de {tbl, row_id, updated_at, deleted, data}. Solo sustituye
-- la versión guardada si la que llega es igual o más reciente (igual: reordenar no cambia
-- `updated_at`). Corre con los permisos del usuario (RLS).
create or replace function public.push_changes(changes jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.sync_rows (user_id, tbl, row_id, updated_at, deleted, data)
  select (select auth.uid()), c.tbl, c.row_id, c.updated_at, c.deleted,
         case when c.deleted then null else c.data end
  from jsonb_to_recordset(changes) as c(tbl text, row_id text, updated_at bigint, deleted boolean, data jsonb)
  on conflict (user_id, tbl, row_id) do update
    set updated_at = excluded.updated_at,
        deleted = excluded.deleted,
        data = excluded.data,
        seq = nextval('public.sync_seq')
    where excluded.updated_at >= public.sync_rows.updated_at;
$$;

grant execute on function public.push_changes(jsonb) to authenticated;
grant usage on sequence public.sync_seq to authenticated;

-- Ficheros de los adjuntos: bucket privado, cada usuario solo ve su carpeta (`<user_id>/<id>`).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists "attachments: leer los propios" on storage.objects;
create policy "attachments: leer los propios" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: subir los propios" on storage.objects;
create policy "attachments: subir los propios" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "attachments: borrar los propios" on storage.objects;
create policy "attachments: borrar los propios" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Eliminar la cuenta desde la app (lo exigen App Store y Google Play). Los ficheros de Storage
-- los borra antes la app con la API de Storage; aquí se borran los datos y el usuario.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  delete from public.sync_rows where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
