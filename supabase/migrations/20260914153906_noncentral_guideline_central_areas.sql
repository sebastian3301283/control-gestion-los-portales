-- HU/DEP/VS/HOT: replace guideline-level responsible managers with explicit Central areas.
-- Unit areas keep using planning_guideline_managements because they drive access and matrix ownership.
-- Central areas are display/planning metadata and therefore live in a separate relation.

create table if not exists public.planning_guideline_central_managements (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  management_id uuid not null references public.managements_global(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, management_id)
);

create index if not exists planning_guideline_central_managements_management_idx
  on public.planning_guideline_central_managements (management_id, guideline_id);

-- Preserve useful legacy information: when an old non-Central responsible manager
-- belonged to an active Central management, convert that association into a Central area.
with mapped as (
  select
    responsible.guideline_id,
    link.management_id,
    min(responsible.sort_order) as first_sort
  from public.planning_guideline_responsibles responsible
  join public.planning_guidelines guideline
    on guideline.id = responsible.guideline_id
   and guideline.unit_code in ('HU', 'DEP', 'VS', 'HOT')
  join public.manager_managements link
    on link.manager_id = responsible.manager_id
  join public.managements_global management
    on management.id = link.management_id
   and management.unit_code = 'CENTRAL'
   and management.active = true
  group by responsible.guideline_id, link.management_id
), ranked as (
  select
    guideline_id,
    management_id,
    (row_number() over (partition by guideline_id order by first_sort, management_id) - 1)::integer as sort_order
  from mapped
)
insert into public.planning_guideline_central_managements (guideline_id, management_id, sort_order)
select guideline_id, management_id, sort_order
from ranked
on conflict (guideline_id, management_id) do nothing;

alter table public.planning_guideline_central_managements enable row level security;

drop policy if exists planning_guideline_central_managements_select on public.planning_guideline_central_managements;
create policy planning_guideline_central_managements_select
on public.planning_guideline_central_managements
for select
to authenticated
using (public.can_access_guideline_multi(guideline_id));

drop policy if exists planning_guideline_central_managements_insert_global on public.planning_guideline_central_managements;
create policy planning_guideline_central_managements_insert_global
on public.planning_guideline_central_managements
for insert
to authenticated
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_central_managements_update_global on public.planning_guideline_central_managements;
create policy planning_guideline_central_managements_update_global
on public.planning_guideline_central_managements
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_central_managements_delete_global on public.planning_guideline_central_managements;
create policy planning_guideline_central_managements_delete_global
on public.planning_guideline_central_managements
for delete
to authenticated
using (public.is_global_planning_manager());

grant select on public.planning_guideline_central_managements to authenticated;
revoke all on public.planning_guideline_central_managements from anon;

create or replace function public.save_planning_guideline_multi(
  guideline_id_input uuid,
  period_id_input uuid,
  unit_code_input text,
  management_ids_input uuid[],
  central_management_ids_input uuid[],
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
  v_central_management_ids uuid[];
begin
  if not public.is_global_planning_manager() then
    raise exception using errcode = '42501', message = 'No tienes permiso para administrar lineamientos.';
  end if;

  if unit_code_input not in ('HU', 'DEP', 'VS', 'HOT') then
    raise exception using errcode = '22023', message = 'Las áreas de Central solo aplican a lineamientos HU, DEP, VS y HOT.';
  end if;

  select array_agg(item_id order by first_ord)
  into v_central_management_ids
  from (
    select item_id, min(ord)::integer as first_ord
    from unnest(coalesce(central_management_ids_input, '{}'::uuid[])) with ordinality as items(item_id, ord)
    where item_id is not null
    group by item_id
  ) deduped;

  if exists (
    select 1
    from unnest(coalesce(v_central_management_ids, '{}'::uuid[])) as selected(management_id)
    where not exists (
      select 1
      from public.managements_global management
      where management.id = selected.management_id
        and management.unit_code = 'CENTRAL'
        and management.active = true
    )
  ) then
    raise exception using errcode = '22023', message = 'Todas las áreas de Central deben estar activas y pertenecer a Central.';
  end if;

  -- The previous wrapper keeps category and Unit-area persistence transactional.
  -- Pass an empty responsible list deliberately: non-Central guidelines no longer pull bonistas.
  v_guideline_id := public.save_planning_guideline_multi(
    guideline_id_input,
    period_id_input,
    unit_code_input,
    management_ids_input,
    category_input,
    code_input,
    guideline_text_input,
    '{}'::uuid[],
    active_input
  );

  delete from public.planning_guideline_central_managements
  where guideline_id = v_guideline_id;

  insert into public.planning_guideline_central_managements (guideline_id, management_id, sort_order)
  select v_guideline_id, selected.management_id, selected.ord::integer - 1
  from unnest(coalesce(v_central_management_ids, '{}'::uuid[])) with ordinality as selected(management_id, ord);

  return v_guideline_id;
end;
$$;

revoke execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], uuid[], text, text, text, uuid[], boolean) from public, anon;
grant execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], uuid[], text, text, text, uuid[], boolean) to authenticated;

notify pgrst, 'reload schema';
