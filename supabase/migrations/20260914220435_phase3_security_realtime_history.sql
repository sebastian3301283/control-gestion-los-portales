-- Fase 3: align non-Central authorization, collaborative locks, matrix history and Realtime.

-- 1) Non-Central subpoints must inherit the same guideline-owned access as matrix rows.
drop policy if exists matrix_row_subpoints_select_area on public.matrix_row_subpoints;
create policy matrix_row_subpoints_select_area
on public.matrix_row_subpoints
for select
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_subpoints.matrix_row_id
      and public.can_access_unit(m.unit_code)
      and (
        public.can_access_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_access_guideline_multi(m.guideline_id)
        )
      )
  )
);

drop policy if exists matrix_row_subpoints_insert_area on public.matrix_row_subpoints;
create policy matrix_row_subpoints_insert_area
on public.matrix_row_subpoints
for insert
to authenticated
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_subpoints.matrix_row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
      )
  )
);

drop policy if exists matrix_row_subpoints_update_area on public.matrix_row_subpoints;
create policy matrix_row_subpoints_update_area
on public.matrix_row_subpoints
for update
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_subpoints.matrix_row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_subpoints.matrix_row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
      )
  )
);

drop policy if exists matrix_row_subpoints_delete_area on public.matrix_row_subpoints;
create policy matrix_row_subpoints_delete_area
on public.matrix_row_subpoints
for delete
to authenticated
using (
  exists (
    select 1
    from public.matrix_rows r
    join public.matrices m on m.id = r.matrix_id
    join public.processes p on p.id = m.process_id
    where r.id = matrix_row_subpoints.matrix_row_id
      and (
        public.is_global_planning_manager()
        or public.can_edit_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
      )
  )
);

-- 2) Collaborative row locks must use the same edit authorization as matrix rows.
create or replace function public.try_lock_matrix_row(row_id_input uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_matrix_id uuid;
  v_unit_code text;
  v_management_id uuid;
  v_guideline_id uuid;
  v_email text;
  v_name text;
  v_lock public.matrix_row_edit_locks%rowtype;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select mr.matrix_id, m.unit_code, p.management_id, m.guideline_id
    into v_matrix_id, v_unit_code, v_management_id, v_guideline_id
  from public.matrix_rows mr
  join public.matrices m on m.id = mr.matrix_id
  join public.processes p on p.id = m.process_id
  where mr.id = row_id_input
  limit 1;

  if v_matrix_id is null then
    raise exception 'ROW_NOT_FOUND';
  end if;

  if not coalesce(
    public.is_global_planning_manager()
    or public.can_edit_management(v_management_id, v_unit_code)
    or (
      v_unit_code <> 'CENTRAL'
      and v_guideline_id is not null
      and public.can_edit_guideline_multi(v_guideline_id)
    ),
    false
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select p.email::text, coalesce(nullif(trim(p.full_name), ''), split_part(p.email::text, '@', 1))
    into v_email, v_name
  from public.profiles p
  where p.user_id = v_uid
  limit 1;

  v_email := coalesce(v_email, 'usuario');
  v_name := coalesce(v_name, v_email);

  delete from public.matrix_row_edit_locks
  where row_id = row_id_input and expires_at <= now();

  insert into public.matrix_row_edit_locks(row_id, matrix_id, user_id, user_email, display_name, locked_at, expires_at)
  values (row_id_input, v_matrix_id, v_uid, v_email, v_name, now(), now() + interval '90 seconds')
  on conflict (row_id) do update
    set matrix_id = excluded.matrix_id,
        user_email = excluded.user_email,
        display_name = excluded.display_name,
        locked_at = now(),
        expires_at = now() + interval '90 seconds'
    where public.matrix_row_edit_locks.user_id = v_uid
       or public.matrix_row_edit_locks.expires_at <= now();

  select * into v_lock
  from public.matrix_row_edit_locks
  where row_id = row_id_input;

  return jsonb_build_object(
    'ok', v_lock.user_id = v_uid,
    'row_id', v_lock.row_id,
    'matrix_id', v_lock.matrix_id,
    'owner_user_id', v_lock.user_id,
    'owner_email', v_lock.user_email,
    'owner_name', v_lock.display_name,
    'expires_at', v_lock.expires_at
  );
end;
$$;

drop policy if exists matrix_row_edit_locks_read on public.matrix_row_edit_locks;
create policy matrix_row_edit_locks_read
on public.matrix_row_edit_locks
for select
to authenticated
using (
  expires_at > now()
  and exists (
    select 1
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_row_edit_locks.matrix_id
      and public.can_access_unit(m.unit_code)
      and (
        public.can_access_management(p.management_id, m.unit_code)
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_access_guideline_multi(m.guideline_id)
        )
      )
  )
);

-- 3) Matrix history must include row responsibles and coalesce them with one UI save.
create or replace function public.capture_matrix_version(matrix_id_input uuid, action_input text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  next_version integer;
  matrix_json jsonb;
  rows_json jsonb;
  subpoints_json jsonb;
  responsibles_json jsonb;
  v_now timestamptz := clock_timestamp();
  v_user_id uuid := auth.uid();
  v_user_email text := auth.jwt()->>'email';
  v_latest_id uuid;
  v_latest_action text;
  v_latest_changed_by uuid;
  v_latest_created_at timestamptz;
  v_coalescible boolean;
begin
  if matrix_id_input is null then
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(matrix_id_input::text, 0));

  select to_jsonb(m)
    into matrix_json
  from public.matrices m
  where m.id = matrix_id_input;

  if matrix_json is null then
    return;
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.sort_order, r.created_at), '[]'::jsonb)
    into rows_json
  from public.matrix_rows r
  where r.matrix_id = matrix_id_input;

  select coalesce(jsonb_agg(to_jsonb(s) order by r.sort_order, s.sort_order, s.created_at), '[]'::jsonb)
    into subpoints_json
  from public.matrix_row_subpoints s
  join public.matrix_rows r on r.id = s.matrix_row_id
  where r.matrix_id = matrix_id_input;

  select coalesce(jsonb_agg(to_jsonb(rr) order by r.sort_order, rr.sort_order, rr.created_at, rr.manager_id), '[]'::jsonb)
    into responsibles_json
  from public.matrix_row_responsibles rr
  join public.matrix_rows r on r.id = rr.row_id
  where r.matrix_id = matrix_id_input;

  select v.id, v.action, v.changed_by, v.created_at
    into v_latest_id, v_latest_action, v_latest_changed_by, v_latest_created_at
  from public.matrix_versions v
  where v.matrix_id = matrix_id_input
  order by v.version_no desc
  limit 1;

  v_coalescible :=
    action_input ~ '^(ROW_|SUBPOINT_|RESPONSIBLE_)'
    and coalesce(v_latest_action, '') ~ '^(ROW_|SUBPOINT_|RESPONSIBLE_)'
    and v_latest_created_at is not null
    and v_latest_created_at >= v_now - interval '3 seconds'
    and v_latest_changed_by is not distinct from v_user_id;

  if v_coalescible then
    update public.matrix_versions
    set snapshot = jsonb_build_object(
          'matrix', matrix_json,
          'rows', rows_json,
          'subpoints', subpoints_json,
          'responsibles', responsibles_json
        ),
        changed_email = coalesce(v_user_email, changed_email),
        created_at = v_now
    where id = v_latest_id;
    return;
  end if;

  select coalesce(max(v.version_no), 0) + 1
    into next_version
  from public.matrix_versions v
  where v.matrix_id = matrix_id_input;

  insert into public.matrix_versions(
    matrix_id,
    version_no,
    action,
    changed_by,
    changed_email,
    snapshot,
    created_at
  )
  values (
    matrix_id_input,
    next_version,
    action_input,
    v_user_id,
    v_user_email,
    jsonb_build_object(
      'matrix', matrix_json,
      'rows', rows_json,
      'subpoints', subpoints_json,
      'responsibles', responsibles_json
    ),
    v_now
  );
end;
$$;

create or replace function public.matrix_row_responsibles_version_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_matrix_id uuid;
begin
  if coalesce(current_setting('app.matrix_restore', true), '0') = '1' then
    return coalesce(new, old);
  end if;

  select r.matrix_id into v_matrix_id
  from public.matrix_rows r
  where r.id = coalesce(new.row_id, old.row_id);

  if v_matrix_id is not null then
    perform public.capture_matrix_version(v_matrix_id, 'RESPONSIBLE_' || tg_op);
  end if;

  return coalesce(new, old);
end;
$$;

revoke execute on function public.matrix_row_responsibles_version_trigger() from public, anon, authenticated;

drop trigger if exists trg_matrix_row_responsibles_version on public.matrix_row_responsibles;
create trigger trg_matrix_row_responsibles_version
after insert or update or delete on public.matrix_row_responsibles
for each row execute function public.matrix_row_responsibles_version_trigger();

create or replace function public.restore_matrix_version_by_context(period_id_input uuid, unit_code_input text, management_name_input text, version_no_input integer)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_matrix_id uuid;
  v_version public.matrix_versions%rowtype;
  v_rows jsonb;
  v_subpoints jsonb;
  v_responsibles jsonb;
  v_matrix jsonb;
  v_has_responsibles_snapshot boolean := false;
  v_restored_count integer := 0;
  v_restored_subpoints integer := 0;
  v_restored_responsibles integer := 0;
begin
  if not public.is_global_planning_manager() then
    raise exception 'Solo Control de Gestión puede restaurar versiones anteriores.' using errcode = '42501';
  end if;

  select m.id into v_matrix_id
  from public.matrices m
  join public.processes p on p.id = m.process_id
  join public.managements_global mg on mg.id = p.management_id
  where m.period_id = period_id_input
    and m.unit_code = unit_code_input
    and m.active = true
    and lower(trim(mg.name)) = lower(trim(management_name_input))
  order by m.created_at
  limit 1;

  if v_matrix_id is null then raise exception 'No se encontró la matriz para el área seleccionada.'; end if;

  select * into v_version
  from public.matrix_versions
  where matrix_id = v_matrix_id and version_no = version_no_input
  limit 1;

  if v_version.id is null then raise exception 'No se encontró la versión solicitada.'; end if;

  v_rows := coalesce(v_version.snapshot->'rows', '[]'::jsonb);
  v_subpoints := coalesce(v_version.snapshot->'subpoints', '[]'::jsonb);
  v_has_responsibles_snapshot := v_version.snapshot ? 'responsibles';
  v_responsibles := coalesce(v_version.snapshot->'responsibles', '[]'::jsonb);
  v_matrix := coalesce(v_version.snapshot->'matrix', '{}'::jsonb);

  -- Versions created before Fase 3 did not persist responsibles. Preserve the
  -- current assignments for row IDs that still exist in the restored version
  -- instead of silently deleting them.
  if not v_has_responsibles_snapshot then
    select coalesce(jsonb_agg(to_jsonb(rr) order by r.sort_order, rr.sort_order, rr.created_at, rr.manager_id), '[]'::jsonb)
      into v_responsibles
    from public.matrix_row_responsibles rr
    join public.matrix_rows r on r.id = rr.row_id
    where r.matrix_id = v_matrix_id;
  end if;

  perform set_config('app.matrix_restore', '1', true);

  delete from public.matrix_rows where matrix_id = v_matrix_id;

  if jsonb_typeof(v_rows) = 'array' and jsonb_array_length(v_rows) > 0 then
    insert into public.matrix_rows
    select * from jsonb_populate_recordset(null::public.matrix_rows, v_rows);
    get diagnostics v_restored_count = row_count;
  end if;

  if jsonb_typeof(v_subpoints) = 'array' and jsonb_array_length(v_subpoints) > 0 then
    insert into public.matrix_row_subpoints
    select * from jsonb_populate_recordset(null::public.matrix_row_subpoints, v_subpoints);
    get diagnostics v_restored_subpoints = row_count;
  end if;

  if jsonb_typeof(v_responsibles) = 'array' and jsonb_array_length(v_responsibles) > 0 then
    insert into public.matrix_row_responsibles(row_id, manager_id, sort_order, created_at)
    select restored.row_id, restored.manager_id, restored.sort_order, restored.created_at
    from jsonb_populate_recordset(null::public.matrix_row_responsibles, v_responsibles) restored
    where exists (
      select 1
      from public.matrix_rows r
      where r.id = restored.row_id
        and r.matrix_id = v_matrix_id
    )
    on conflict (row_id, manager_id) do nothing;
    get diagnostics v_restored_responsibles = row_count;
  end if;

  update public.matrices
  set name = coalesce(nullif(v_matrix->>'name',''), name),
      description = case when v_matrix ? 'description' then v_matrix->>'description' else description end,
      status = coalesce(nullif(v_matrix->>'status',''), status),
      sort_order = coalesce((v_matrix->>'sort_order')::integer, sort_order),
      guideline_text = case when v_matrix ? 'guideline_text' then v_matrix->>'guideline_text' else guideline_text end,
      guideline_id = case when nullif(v_matrix->>'guideline_id','') is not null then (v_matrix->>'guideline_id')::uuid else guideline_id end,
      updated_at = now()
  where id = v_matrix_id;

  perform set_config('app.matrix_restore', '0', true);
  perform public.capture_matrix_version(v_matrix_id, 'RESTORE');

  return jsonb_build_object(
    'matrix_id', v_matrix_id,
    'restored_version', version_no_input,
    'rows_restored', v_restored_count,
    'subpoints_restored', v_restored_subpoints,
    'responsibles_restored', v_restored_responsibles
  );
end;
$$;

-- 4) Matrix metadata changes share the existing per-matrix Realtime channel.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matrices'
  ) then
    alter publication supabase_realtime add table public.matrices;
  end if;
end
$$;

notify pgrst, 'reload schema';