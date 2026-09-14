-- HU/DEP/VS/HOT: keep visible "Áreas de Central" as free-text labels.
-- Matching Central management relations remain separate for technical compatibility.

create table if not exists public.planning_guideline_central_area_labels (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, label),
  constraint planning_guideline_central_area_labels_not_blank check (nullif(btrim(label), '') is not null)
);

create index if not exists planning_guideline_central_area_labels_guideline_idx
  on public.planning_guideline_central_area_labels (guideline_id, sort_order);

with source as (
  select
    relation.guideline_id,
    management.name as label,
    relation.sort_order,
    row_number() over (
      partition by relation.guideline_id, lower(btrim(management.name))
      order by relation.sort_order, management.id
    ) as duplicate_rank
  from public.planning_guideline_central_managements relation
  join public.planning_guidelines guideline
    on guideline.id = relation.guideline_id
   and guideline.unit_code in ('HU', 'DEP', 'VS', 'HOT')
  join public.managements_global management
    on management.id = relation.management_id
)
insert into public.planning_guideline_central_area_labels (guideline_id, label, sort_order)
select guideline_id, label, sort_order
from source
where duplicate_rank = 1
on conflict (guideline_id, label) do nothing;

alter table public.planning_guideline_central_area_labels enable row level security;

drop policy if exists planning_guideline_central_area_labels_select on public.planning_guideline_central_area_labels;
create policy planning_guideline_central_area_labels_select
on public.planning_guideline_central_area_labels
for select
to authenticated
using (public.can_access_guideline_multi(guideline_id));

drop policy if exists planning_guideline_central_area_labels_insert_global on public.planning_guideline_central_area_labels;
create policy planning_guideline_central_area_labels_insert_global
on public.planning_guideline_central_area_labels
for insert
to authenticated
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_central_area_labels_update_global on public.planning_guideline_central_area_labels;
create policy planning_guideline_central_area_labels_update_global
on public.planning_guideline_central_area_labels
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_central_area_labels_delete_global on public.planning_guideline_central_area_labels;
create policy planning_guideline_central_area_labels_delete_global
on public.planning_guideline_central_area_labels
for delete
to authenticated
using (public.is_global_planning_manager());

grant select on public.planning_guideline_central_area_labels to authenticated;
revoke all on public.planning_guideline_central_area_labels from anon;

create or replace function public.save_planning_guideline_multi(
  guideline_id_input uuid,
  period_id_input uuid,
  unit_code_input text,
  management_ids_input uuid[],
  central_management_ids_input uuid[],
  unit_area_labels_input text[],
  central_area_labels_input text[],
  category_input text,
  code_input text,
  guideline_text_input text,
  responsible_ids_input uuid[],
  active_input boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_guideline_id uuid;
  v_central_area_labels text[];
begin
  if not public.is_global_planning_manager() then
    raise exception using errcode = '42501', message = 'No tienes permiso para administrar lineamientos.';
  end if;

  if unit_code_input not in ('HU', 'DEP', 'VS', 'HOT') then
    raise exception using errcode = '22023', message = 'Las Áreas de Central manuales solo aplican a HU, DEP, VS y HOT.';
  end if;

  select array_agg(label order by first_ord)
  into v_central_area_labels
  from (
    select min(btrim(item_label)) as label, min(ord)::integer as first_ord
    from unnest(coalesce(central_area_labels_input, '{}'::text[])) with ordinality as items(item_label, ord)
    where nullif(btrim(item_label), '') is not null
    group by lower(btrim(item_label))
  ) deduped;

  v_guideline_id := public.save_planning_guideline_multi(
    guideline_id_input,
    period_id_input,
    unit_code_input,
    management_ids_input,
    central_management_ids_input,
    unit_area_labels_input,
    category_input,
    code_input,
    guideline_text_input,
    '{}'::uuid[],
    active_input
  );

  delete from public.planning_guideline_central_area_labels
  where guideline_id = v_guideline_id;

  insert into public.planning_guideline_central_area_labels (guideline_id, label, sort_order)
  select v_guideline_id, selected.label, selected.ord::integer - 1
  from unnest(coalesce(v_central_area_labels, '{}'::text[])) with ordinality as selected(label, ord);

  return v_guideline_id;
end;
$$;

revoke execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], uuid[], text[], text[], text, text, text, uuid[], boolean) from public, anon;
grant execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], uuid[], text[], text[], text, text, text, uuid[], boolean) to authenticated;

notify pgrst, 'reload schema';
