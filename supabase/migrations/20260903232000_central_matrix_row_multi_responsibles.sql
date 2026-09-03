create table if not exists public.matrix_row_responsibles (
  row_id uuid not null references public.matrix_rows(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (row_id, manager_id)
);

create index if not exists matrix_row_responsibles_manager_idx
  on public.matrix_row_responsibles(manager_id);

alter table public.matrix_row_responsibles enable row level security;

drop policy if exists matrix_row_responsibles_select_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_select_area
on public.matrix_row_responsibles for select
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and can_access_unit(m.unit_code)
      and can_access_management(p.management_id, m.unit_code)
  )
);

drop policy if exists matrix_row_responsibles_insert_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_insert_area
on public.matrix_row_responsibles for insert
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (is_global_planning_manager() or can_edit_management(p.management_id, m.unit_code))
  )
);

drop policy if exists matrix_row_responsibles_update_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_update_area
on public.matrix_row_responsibles for update
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (is_global_planning_manager() or can_edit_management(p.management_id, m.unit_code))
  )
)
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (is_global_planning_manager() or can_edit_management(p.management_id, m.unit_code))
  )
);

drop policy if exists matrix_row_responsibles_delete_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_delete_area
on public.matrix_row_responsibles for delete
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (is_global_planning_manager() or can_edit_management(p.management_id, m.unit_code))
  )
);

insert into public.matrix_row_responsibles (row_id, manager_id, sort_order)
select id, responsible_manager_id, 0
from public.matrix_rows
where responsible_manager_id is not null
on conflict (row_id, manager_id) do nothing;
