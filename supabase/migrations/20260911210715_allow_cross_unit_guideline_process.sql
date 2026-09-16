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

  select m.* into v_management
  from public.managements_global m
  join public.matrix_unit_area_catalog catalog
    on catalog.management_id = m.id
  where m.id = management_id_input
    and m.active = true
    and catalog.unit_code = unit_code_input
    and catalog.management_id = management_id_input
  limit 1;

  if v_management.id is null then
    raise exception using errcode = '22023', message = 'La gerencia seleccionada no está activa para la unidad indicada.';
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
      'Proceso automático para matrices por lineamiento',
      true,
      0
    )
    returning id into v_process_id;
  end if;

  return v_process_id;
end;
$$;

revoke execute on function public.ensure_noncentral_guideline_process(text, uuid) from public, anon, authenticated;

notify pgrst, 'reload schema';