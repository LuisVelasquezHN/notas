-- Sincronización en tiempo real (PLAN.md §9). Ejecutar una vez en el editor SQL de Supabase.
-- Es idempotente.
--
-- Publica los cambios de `sync_rows` por Supabase Realtime: cada dispositivo con sesión recibe
-- un aviso cuando cambia una fila de SU cuenta (Realtime aplica las mismas políticas RLS que las
-- consultas) y sincroniza al momento, en vez de esperar a la siguiente comprobación periódica.
-- El aviso no lleva los datos que usa la app: esta los pide después con su sesión.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sync_rows'
  ) then
    alter publication supabase_realtime add table public.sync_rows;
  end if;
end;
$$;
