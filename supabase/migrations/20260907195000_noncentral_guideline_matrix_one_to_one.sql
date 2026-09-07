-- HU/DEP/VS/HOT: one planning guideline owns exactly one matrix.
-- Existing non-Central operational content is test data and is intentionally reset.

-- Remove obsolete matrix containers first so dependent rows, versions and locks cascade safely.
delete from public.matrices
where unit_code in ('HU', 'DEP', 'VS', 'HOT');

-- Remove the obsolete non-Central planning guidelines. Central is intentionally untouched.
delete from public.planning_guidelines
where unit_code in ('HU', 'DEP', 'VS', 'HOT');

-- A non-Central guideline can own only one matrix. Central keeps its existing model.
create unique index if not exists matrices_noncentral_guideline_uidx
  on public.matrices (guideline_id)
  where guideline_id is not null
    and unit_code in ('HU', 'DEP', 'VS', 'HOT');

create or replace function public.sync_noncentral_guideline_matrix()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_process_id uuid;
  v_directory_group text;
  v_process_count integer;
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

  -- If an existing non-Central guideline is ever moved out of this model,
  -- remove its old matrix before handling the new state.
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

  select
    count(*)::integer,
    min(p.id::text)::uuid,
    min(p.directory_group)
  into v_process_count, v_process_id, v_directory_group
  from public.processes p
  where p.management_id = new.management_id
    and p.unit_code = new.unit_code
    and p.active = true;

  if v_process_count <> 1 or v_process_id is null then
    raise exception using
      errcode = 'P0001',
      message = format(
        'El lineamiento requiere exactamente un proceso activo para unidad %s y gerencia %s; se encontraron %s.',
        new.unit_code,
        new.management_id,
        v_process_count
      );
  end if;

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

drop trigger if exists planning_guidelines_noncentral_matrix_sync on public.planning_guidelines;
create trigger planning_guidelines_noncentral_matrix_sync
after insert or update or delete on public.planning_guidelines
for each row
execute function public.sync_noncentral_guideline_matrix();
