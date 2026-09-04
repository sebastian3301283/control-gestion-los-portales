-- Matrix collaboration depends on every persisted relation emitting Postgres Changes.
-- Keep this migration idempotent because older environments may already publish
-- some of the relations.
do $$
declare
  relation_name text;
begin
  foreach relation_name in array array[
    'matrix_rows',
    'matrix_row_subpoints',
    'matrix_row_responsibles',
    'matrix_row_edit_locks'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = relation_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', relation_name);
    end if;
  end loop;
end;
$$;

-- Complete old records let clients route UPDATE/DELETE events and converge even
-- when a relation is removed before the receiving client can resolve its parent.
alter table public.matrix_rows replica identity full;
alter table public.matrix_row_subpoints replica identity full;
alter table public.matrix_row_responsibles replica identity full;
alter table public.matrix_row_edit_locks replica identity full;

create index if not exists matrix_row_subpoints_row_sort_idx
  on public.matrix_row_subpoints(matrix_row_id, sort_order);

