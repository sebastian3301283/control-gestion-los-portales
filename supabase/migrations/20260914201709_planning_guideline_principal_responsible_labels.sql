create table if not exists public.planning_guideline_principal_responsible_labels (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, label),
  constraint planning_guideline_principal_responsible_labels_not_blank check (nullif(btrim(label), '') is not null)
);

create index if not exists planning_guideline_principal_responsible_labels_guideline_idx
  on public.planning_guideline_principal_responsible_labels (guideline_id, sort_order);

create unique index if not exists planning_guideline_principal_responsible_labels_normalized_uidx
  on public.planning_guideline_principal_responsible_labels (guideline_id, lower(btrim(label)));

with source as (
  select distinct on (matrix.guideline_id, lower(btrim(existing.label)))
    matrix.guideline_id,
    btrim(existing.label) as label,
    existing.sort_order
  from public.matrix_principal_responsible_labels existing
  join public.matrices matrix on matrix.id = existing.matrix_id
  join public.planning_guidelines guideline on guideline.id = matrix.guideline_id
  where matrix.guideline_id is not null
    and guideline.unit_code in ('HU', 'DEP', 'VS', 'HOT')
    and nullif(btrim(existing.label), '') is not null
  order by matrix.guideline_id, lower(btrim(existing.label)), existing.sort_order
)
insert into public.planning_guideline_principal_responsible_labels (guideline_id, label, sort_order)
select guideline_id, label, sort_order
from source
on conflict do nothing;

alter table public.planning_guideline_principal_responsible_labels enable row level security;

drop policy if exists planning_guideline_principal_responsible_labels_select on public.planning_guideline_principal_responsible_labels;
create policy planning_guideline_principal_responsible_labels_select
on public.planning_guideline_principal_responsible_labels
for select
to authenticated
using (
  exists (
    select 1
    from public.planning_guidelines guideline
    where guideline.id = planning_guideline_principal_responsible_labels.guideline_id
      and public.can_access_unit(guideline.unit_code)
  )
);

drop policy if exists planning_guideline_principal_responsible_labels_insert_global on public.planning_guideline_principal_responsible_labels;
create policy planning_guideline_principal_responsible_labels_insert_global
on public.planning_guideline_principal_responsible_labels
for insert
to authenticated
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_principal_responsible_labels_update_global on public.planning_guideline_principal_responsible_labels;
create policy planning_guideline_principal_responsible_labels_update_global
on public.planning_guideline_principal_responsible_labels
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_principal_responsible_labels_delete_global on public.planning_guideline_principal_responsible_labels;
create policy planning_guideline_principal_responsible_labels_delete_global
on public.planning_guideline_principal_responsible_labels
for delete
to authenticated
using (public.is_global_planning_manager());

grant select, insert, update, delete on public.planning_guideline_principal_responsible_labels to authenticated;
revoke all on public.planning_guideline_principal_responsible_labels from anon;

notify pgrst, 'reload schema';
