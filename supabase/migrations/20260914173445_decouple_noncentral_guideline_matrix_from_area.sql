-- HU/DEP/VS/HOT are owned by lineamiento. Visible area labels are metadata only.
-- Keep management/process ids only as hidden compatibility for the legacy non-null schema.

create or replace function public.ensure_noncentral_guideline_process(
  unit_code_input text,
  management_id_input uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_management public.managements_global%rowtype;
  v_process_id uuid;
begin
  if unit_code_input not in ('HU','DEP','VS','HOT') then
    raise exception using errcode = '22023', message = 'Unidad no Central no válida.';
  end if;

  select * into v_management
  from public.managements_global
  where id = management_id_input
    and unit_code = unit_code_input
    and active = true;

  if v_management.id is null then
    raise exception using errcode = '22023', message = 'No existe configuración interna activa para la unidad indicada.';
  end if;

  select p.id into v_process_id
  from public.processes p
  where p.management_id = management_id_input
    and p.unit_code = unit_code_input
    and p.active = true
  order by p.sort_order, p.created_at, p.id
  limit 1;

  if v_process_id is null then
    insert into public.processes(
      unit_code,
      directory_group,
      management_id,
      name,
      description,
      active,
      sort_order
    ) values (
      unit_code_input,
      v_management.directory_group,
      management_id_input,
      'Matriz general',
      'Proceso interno para matrices exclusivas por lineamiento',
      true,
      0
    )
    returning id into v_process_id;
  end if;

  return v_process_id;
end;
$$;

revoke execute on function public.ensure_noncentral_guideline_process(text, uuid) from public, anon, authenticated;

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
    raise exception using errcode = '22023', message = 'No existe configuración interna activa para esta unidad.';
  end if;

  if exists (
    select 1
    from unnest(v_management_ids) as selected(management_id)
    where not exists (
      select 1
      from public.managements_global management
      where management.id = selected.management_id
        and management.unit_code = unit_code_input
        and management.active = true
    )
  ) then
    raise exception using errcode = '22023', message = 'La configuración interna no corresponde a la unidad indicada.';
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
    raise exception using errcode = '22023', message = 'Cada responsable debe estar activo y vinculado a la unidad.';
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

notify pgrst, 'reload schema';
