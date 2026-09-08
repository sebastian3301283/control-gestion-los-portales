-- HU/DEP/VS/HOT: allow a planning guideline to belong to multiple managements
-- and multiple responsible managers while keeping the legacy primary columns
-- compatible with the existing one-guideline/one-matrix trigger.

create table if not exists public.planning_guideline_managements (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  management_id uuid not null references public.managements_global(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, management_id)
);

create index if not exists planning_guideline_managements_management_idx
  on public.planning_guideline_managements (management_id, guideline_id);

create table if not exists public.planning_guideline_responsibles (
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  manager_id uuid not null references public.managers(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (guideline_id, manager_id)
);

create index if not exists planning_guideline_responsibles_manager_idx
  on public.planning_guideline_responsibles (manager_id, guideline_id);

insert into public.planning_guideline_managements (guideline_id, management_id, sort_order)
select g.id, g.management_id, 0
from public.planning_guidelines g
on conflict (guideline_id, management_id) do nothing;

insert into public.planning_guideline_responsibles (guideline_id, manager_id, sort_order)
select g.id, g.responsible_manager_id, 0
from public.planning_guidelines g
where g.responsible_manager_id is not null
on conflict (guideline_id, manager_id) do nothing;

alter table public.planning_guideline_managements enable row level security;
alter table public.planning_guideline_responsibles enable row level security;

create or replace function public.can_access_guideline_multi(guideline_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce((
    select case
      when g.unit_code = 'CENTRAL' then public.can_access_management(g.management_id, g.unit_code)
      else public.can_access_management(g.management_id, g.unit_code)
        or exists (
          select 1
          from public.planning_guideline_managements gm
          where gm.guideline_id = g.id
            and public.can_access_management(gm.management_id, g.unit_code)
        )
    end
    from public.planning_guidelines g
    where g.id = guideline_id_input
  ), false);
$$;

create or replace function public.can_edit_guideline_multi(guideline_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_global_planning_manager()
    or coalesce((
      select case
        when g.unit_code = 'CENTRAL' then public.can_edit_management(g.management_id, g.unit_code)
        else public.can_edit_management(g.management_id, g.unit_code)
          or exists (
            select 1
            from public.planning_guideline_managements gm
            where gm.guideline_id = g.id
              and public.can_edit_management(gm.management_id, g.unit_code)
          )
      end
      from public.planning_guidelines g
      where g.id = guideline_id_input
    ), false);
$$;

revoke execute on function public.can_access_guideline_multi(uuid) from public, anon;
revoke execute on function public.can_edit_guideline_multi(uuid) from public, anon;
grant execute on function public.can_access_guideline_multi(uuid) to authenticated;
grant execute on function public.can_edit_guideline_multi(uuid) to authenticated;

drop policy if exists planning_guideline_managements_select on public.planning_guideline_managements;
create policy planning_guideline_managements_select
on public.planning_guideline_managements
for select
to authenticated
using (public.can_access_guideline_multi(guideline_id));

drop policy if exists planning_guideline_managements_manage_global on public.planning_guideline_managements;
create policy planning_guideline_managements_manage_global
on public.planning_guideline_managements
for all
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists planning_guideline_responsibles_select on public.planning_guideline_responsibles;
create policy planning_guideline_responsibles_select
on public.planning_guideline_responsibles
for select
to authenticated
using (public.can_access_guideline_multi(guideline_id));

drop policy if exists planning_guideline_responsibles_manage_global on public.planning_guideline_responsibles;
create policy planning_guideline_responsibles_manage_global
on public.planning_guideline_responsibles
for all
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

grant select on public.planning_guideline_managements to authenticated;
grant select on public.planning_guideline_responsibles to authenticated;
revoke all on public.planning_guideline_managements from anon;
revoke all on public.planning_guideline_responsibles from anon;

create or replace function public.save_planning_guideline_multi(
  guideline_id_input uuid,
  period_id_input uuid,
  unit_code_input text,
  management_ids_input uuid[],
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
  v_management_ids uuid[];
  v_responsible_ids uuid[];
  v_primary_management_id uuid;
  v_primary_responsible_id uuid;
  v_sort_order integer;
begin
  if not public.is_global_planning_manager() then
    raise exception using errcode = '42501', message = 'No tienes permiso para administrar lineamientos.';
  end if;

  if unit_code_input not in ('HU', 'DEP', 'VS', 'HOT') then
    raise exception using errcode = '22023', message = 'El guardado múltiple solo aplica a HU, DEP, VS y HOT.';
  end if;

  if period_id_input is null or nullif(btrim(guideline_text_input), '') is null then
    raise exception using errcode = '22023', message = 'Periodo y lineamiento son obligatorios.';
  end if;

  select array_agg(item_id order by first_ord)
  into v_management_ids
  from (
    select item_id, min(ord)::integer as first_ord
    from unnest(coalesce(management_ids_input, '{}'::uuid[])) with ordinality as items(item_id, ord)
    where item_id is not null
    group by item_id
  ) deduped;

  if coalesce(cardinality(v_management_ids), 0) = 0 then
    raise exception using errcode = '22023', message = 'Selecciona al menos una gerencia responsable.';
  end if;

  if exists (
    select 1
    from unnest(v_management_ids) as selected(management_id)
    where not exists (
      select 1
      from public.matrix_unit_area_catalog catalog
      join public.managements_global management on management.id = catalog.management_id
      where catalog.unit_code = unit_code_input
        and catalog.management_id = selected.management_id
        and management.active = true
    )
  ) then
    raise exception using errcode = '22023', message = 'Todas las gerencias deben estar activadas para la unidad.';
  end if;

  select array_agg(item_id order by first_ord)
  into v_responsible_ids
  from (
    select item_id, min(ord)::integer as first_ord
    from unnest(coalesce(responsible_ids_input, '{}'::uuid[])) with ordinality as items(item_id, ord)
    where item_id is not null
    group by item_id
  ) deduped;

  if exists (
    select 1
    from unnest(coalesce(v_responsible_ids, '{}'::uuid[])) as selected(manager_id)
    where not exists (
      select 1
      from public.managers manager
      where manager.id = selected.manager_id
        and manager.active = true
        and exists (
          select 1
          from public.manager_managements link
          where link.manager_id = manager.id
            and link.management_id = any(v_management_ids)
        )
    )
  ) then
    raise exception using errcode = '22023', message = 'Cada responsable debe estar activo y vinculado a una gerencia seleccionada.';
  end if;

  v_primary_management_id := v_management_ids[1];
  v_primary_responsible_id := case when coalesce(cardinality(v_responsible_ids), 0) > 0 then v_responsible_ids[1] else null end;

  if guideline_id_input is null then
    select coalesce(max(g.sort_order), -1) + 1
    into v_sort_order
    from public.planning_guidelines g
    where g.period_id = period_id_input
      and g.unit_code = unit_code_input;

    insert into public.planning_guidelines (
      period_id,
      unit_code,
      management_id,
      code,
      guideline_text,
      responsible_manager_id,
      active,
      sort_order
    ) values (
      period_id_input,
      unit_code_input,
      v_primary_management_id,
      nullif(upper(btrim(code_input)), ''),
      btrim(guideline_text_input),
      v_primary_responsible_id,
      coalesce(active_input, true),
      v_sort_order
    )
    returning id into v_guideline_id;
  else
    if not exists (
      select 1
      from public.planning_guidelines g
      where g.id = guideline_id_input
        and g.unit_code in ('HU', 'DEP', 'VS', 'HOT')
    ) then
      raise exception using errcode = 'P0002', message = 'No encontramos el lineamiento no Central solicitado.';
    end if;

    update public.planning_guidelines
    set period_id = period_id_input,
        unit_code = unit_code_input,
        management_id = v_primary_management_id,
        code = nullif(upper(btrim(code_input)), ''),
        guideline_text = btrim(guideline_text_input),
        responsible_manager_id = v_primary_responsible_id,
        active = coalesce(active_input, true)
    where id = guideline_id_input
    returning id into v_guideline_id;
  end if;

  delete from public.planning_guideline_managements
  where guideline_id = v_guideline_id;

  insert into public.planning_guideline_managements (guideline_id, management_id, sort_order)
  select v_guideline_id, selected.management_id, selected.ord::integer - 1
  from unnest(v_management_ids) with ordinality as selected(management_id, ord);

  delete from public.planning_guideline_responsibles
  where guideline_id = v_guideline_id;

  insert into public.planning_guideline_responsibles (guideline_id, manager_id, sort_order)
  select v_guideline_id, selected.manager_id, selected.ord::integer - 1
  from unnest(coalesce(v_responsible_ids, '{}'::uuid[])) with ordinality as selected(manager_id, ord);

  return v_guideline_id;
end;
$$;

revoke execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], text, text, uuid[], boolean) from public, anon;
grant execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], text, text, uuid[], boolean) to authenticated;

-- Let authenticated users see a non-Central guideline when they can access any
-- management attached to it. Central retains its primary-management behavior.
drop policy if exists planning_guidelines_select_authenticated on public.planning_guidelines;
create policy planning_guidelines_select_authenticated
on public.planning_guidelines
for select
to authenticated
using (
  auth.uid() is not null
  and public.can_access_unit(unit_code)
  and (
    (unit_code = 'CENTRAL' and public.can_access_management(management_id, unit_code))
    or (unit_code <> 'CENTRAL' and public.can_access_guideline_multi(id))
  )
);

-- Matrices: preserve the process-based path and add a non-Central guideline path.
drop policy if exists matrices_select_area on public.matrices;
create policy matrices_select_area
on public.matrices
for select
to authenticated
using (
  public.can_access_unit(unit_code)
  and (
    exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and public.can_access_management(p.management_id, matrices.unit_code)
    )
    or (
      matrices.unit_code <> 'CENTRAL'
      and matrices.guideline_id is not null
      and public.can_access_guideline_multi(matrices.guideline_id)
    )
  )
);

drop policy if exists matrices_insert_area on public.matrices;
create policy matrices_insert_area
on public.matrices
for insert
to authenticated
with check (
  public.can_access_unit(unit_code)
  and (
    exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, matrices.unit_code))
    )
    or (
      matrices.unit_code <> 'CENTRAL'
      and matrices.guideline_id is not null
      and public.can_edit_guideline_multi(matrices.guideline_id)
    )
  )
);

drop policy if exists matrices_update_area on public.matrices;
create policy matrices_update_area
on public.matrices
for update
to authenticated
using (
  public.is_global_planning_manager()
  or exists (
    select 1 from public.processes p
    where p.id = matrices.process_id
      and public.can_edit_management(p.management_id, matrices.unit_code)
  )
  or (
    matrices.unit_code <> 'CENTRAL'
    and matrices.guideline_id is not null
    and public.can_edit_guideline_multi(matrices.guideline_id)
  )
)
with check (
  public.can_access_unit(unit_code)
  and (
    public.is_global_planning_manager()
    or exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and public.can_edit_management(p.management_id, matrices.unit_code)
    )
    or (
      matrices.unit_code <> 'CENTRAL'
      and matrices.guideline_id is not null
      and public.can_edit_guideline_multi(matrices.guideline_id)
    )
  )
);

drop policy if exists matrices_delete_area on public.matrices;
create policy matrices_delete_area
on public.matrices
for delete
to authenticated
using (
  public.is_global_planning_manager()
  or exists (
    select 1 from public.processes p
    where p.id = matrices.process_id
      and public.can_edit_management(p.management_id, matrices.unit_code)
  )
  or (
    matrices.unit_code <> 'CENTRAL'
    and matrices.guideline_id is not null
    and public.can_edit_guideline_multi(matrices.guideline_id)
  )
);

-- Matrix rows inherit either the process access or any related guideline management.
drop policy if exists matrix_rows_select_area on public.matrix_rows;
create policy matrix_rows_select_area
on public.matrix_rows
for select
to authenticated
using (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and public.can_access_unit(m.unit_code)
      and (
        public.can_access_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_rows_insert_area on public.matrix_rows;
create policy matrix_rows_insert_area
on public.matrix_rows
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_rows_update_area on public.matrix_rows;
create policy matrix_rows_update_area
on public.matrix_rows
for update
to authenticated
using (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_rows_delete_area on public.matrix_rows;
create policy matrix_rows_delete_area
on public.matrix_rows
for delete
to authenticated
using (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

-- Row-responsible links need the same access path as their parent matrix row.
drop policy if exists matrix_row_responsibles_select_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_select_area
on public.matrix_row_responsibles
for select
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and public.can_access_unit(m.unit_code)
      and (
        public.can_access_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_row_responsibles_insert_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_insert_area
on public.matrix_row_responsibles
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_row_responsibles_update_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_update_area
on public.matrix_row_responsibles
for update
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
)
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

drop policy if exists matrix_row_responsibles_delete_area on public.matrix_row_responsibles;
create policy matrix_row_responsibles_delete_area
on public.matrix_row_responsibles
for delete
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_responsibles.row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

-- Historial is readable by every management related to the non-Central guideline.
drop policy if exists matrix_versions_select_access on public.matrix_versions;
create policy matrix_versions_select_access
on public.matrix_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_versions.matrix_id
      and (
        public.can_access_management(p.management_id, m.unit_code)
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
      )
  )
);
