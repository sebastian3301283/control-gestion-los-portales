create table if not exists public.matrix_principal_responsible_labels (
  matrix_id uuid not null references public.matrices(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (matrix_id, label),
  constraint matrix_principal_responsible_labels_not_blank check (nullif(btrim(label), '') is not null)
);

create index if not exists matrix_principal_responsible_labels_matrix_idx
  on public.matrix_principal_responsible_labels (matrix_id, sort_order);

create unique index if not exists matrix_principal_responsible_labels_normalized_uidx
  on public.matrix_principal_responsible_labels (matrix_id, lower(btrim(label)));

with source as (
  select
    matrix.id as matrix_id,
    manager.name as label
  from public.matrices matrix
  join public.processes process on process.id = matrix.process_id
  join public.managers manager on manager.id = matrix.principal_responsible_manager_id
  where process.unit_code in ('HU', 'DEP', 'VS', 'HOT')
    and nullif(btrim(manager.name), '') is not null
)
insert into public.matrix_principal_responsible_labels (matrix_id, label, sort_order)
select matrix_id, label, 0
from source
on conflict do nothing;

alter table public.matrix_principal_responsible_labels enable row level security;

drop policy if exists matrix_principal_responsible_labels_select on public.matrix_principal_responsible_labels;
create policy matrix_principal_responsible_labels_select
on public.matrix_principal_responsible_labels
for select
to authenticated
using (
  exists (
    select 1
    from public.matrices matrix
    where matrix.id = matrix_principal_responsible_labels.matrix_id
      and public.can_access_unit(matrix.unit_code)
  )
);

drop policy if exists matrix_principal_responsible_labels_insert_global on public.matrix_principal_responsible_labels;
create policy matrix_principal_responsible_labels_insert_global
on public.matrix_principal_responsible_labels
for insert
to authenticated
with check (public.is_global_planning_manager());

drop policy if exists matrix_principal_responsible_labels_update_global on public.matrix_principal_responsible_labels;
create policy matrix_principal_responsible_labels_update_global
on public.matrix_principal_responsible_labels
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists matrix_principal_responsible_labels_delete_global on public.matrix_principal_responsible_labels;
create policy matrix_principal_responsible_labels_delete_global
on public.matrix_principal_responsible_labels
for delete
to authenticated
using (public.is_global_planning_manager());

grant select, insert, update, delete on public.matrix_principal_responsible_labels to authenticated;
revoke all on public.matrix_principal_responsible_labels from anon;

notify pgrst, 'reload schema';
