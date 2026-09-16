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
    raise exception using errcode = '22023', message = 'La gerencia seleccionada no pertenece a la unidad indicada o está inactiva.';
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

create or replace function public.sync_noncentral_guideline_matrix()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_process_id uuid;
  v_directory_group text;
  v_sort_order integer;
  v_matrix_name text;
begin
  if tg_op = 'DELETE' then
    if old.unit_code in ('HU', 'DEP', 'VS', 'HOT') then
      delete from public.matrices
      where guideline_id = old.id
        and unit_code in ('HU', 'DEP', 'VS', 'HOT');
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE'
     and old.unit_code in ('HU', 'DEP', 'VS', 'HOT')
     and new.unit_code not in ('HU', 'DEP', 'VS', 'HOT') then
    delete from public.matrices
    where guideline_id = old.id
      and unit_code in ('HU', 'DEP', 'VS', 'HOT');
    return new;
  end if;

  if new.unit_code not in ('HU', 'DEP', 'VS', 'HOT') then
    return new;
  end if;

  v_process_id := public.ensure_noncentral_guideline_process(new.unit_code, new.management_id);

  select p.directory_group into v_directory_group
  from public.processes p
  where p.id = v_process_id;

  v_matrix_name := format(
    'Matriz %s · %s',
    coalesce(nullif(btrim(new.code), ''), 'Lineamiento'),
    left(new.id::text, 8)
  );

  if tg_op = 'INSERT'
     or not exists (
       select 1
       from public.matrices m
       where m.guideline_id = new.id
         and m.unit_code in ('HU', 'DEP', 'VS', 'HOT')
     ) then
    select coalesce(max(m.sort_order), -1) + 1
    into v_sort_order
    from public.matrices m
    where m.period_id = new.period_id
      and m.process_id = v_process_id;

    insert into public.matrices (
      period_id,
      unit_code,
      directory_group,
      process_id,
      name,
      description,
      status,
      active,
      sort_order,
      guideline_id,
      guideline_text
    ) values (
      new.period_id,
      new.unit_code,
      v_directory_group,
      v_process_id,
      v_matrix_name,
      'Matriz exclusiva del lineamiento ' || coalesce(new.code, left(new.id::text, 8)),
      'DRAFT',
      true,
      v_sort_order,
      new.id,
      new.guideline_text
    );
  else
    update public.matrices
    set period_id = new.period_id,
        unit_code = new.unit_code,
        directory_group = v_directory_group,
        process_id = v_process_id,
        name = v_matrix_name,
        guideline_text = new.guideline_text,
        updated_at = now()
    where guideline_id = new.id
      and unit_code in ('HU', 'DEP', 'VS', 'HOT');
  end if;

  return new;
end;
$$;

revoke execute on function public.sync_noncentral_guideline_matrix() from public, anon, authenticated;