-- HU/VS/DEP/HOT: explicit access/edit authorization by planning guideline.
-- CENTRAL intentionally keeps its existing area-based authorization model.

create table if not exists public.guideline_user_permissions (
  id uuid primary key default gen_random_uuid(),
  authorized_user_id uuid not null references public.authorized_users(id) on delete cascade,
  guideline_id uuid not null references public.planning_guidelines(id) on delete cascade,
  can_view boolean not null default true,
  can_edit boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (authorized_user_id, guideline_id),
  check (not can_edit or can_view)
);

create index if not exists guideline_user_permissions_guideline_idx
  on public.guideline_user_permissions (guideline_id, authorized_user_id);

alter table public.guideline_user_permissions enable row level security;

create or replace function public.validate_guideline_user_permission()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_unit_code text;
begin
  select g.unit_code into v_unit_code
  from public.planning_guidelines g
  where g.id = new.guideline_id;

  if v_unit_code not in ('HU', 'VS', 'DEP', 'HOT') then
    raise exception using errcode = '22023', message = 'Los permisos por lineamiento solo aplican a HU, VS, DEP y HOT.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function public.validate_guideline_user_permission() from public, anon, authenticated;

drop trigger if exists trg_validate_guideline_user_permission on public.guideline_user_permissions;
create trigger trg_validate_guideline_user_permission
before insert or update of guideline_id, can_view, can_edit
on public.guideline_user_permissions
for each row execute function public.validate_guideline_user_permission();

drop policy if exists guideline_user_permissions_select_global on public.guideline_user_permissions;
create policy guideline_user_permissions_select_global
on public.guideline_user_permissions
for select
to authenticated
using (public.is_global_planning_manager());

drop policy if exists guideline_user_permissions_insert_global on public.guideline_user_permissions;
create policy guideline_user_permissions_insert_global
on public.guideline_user_permissions
for insert
to authenticated
with check (public.is_global_planning_manager());

drop policy if exists guideline_user_permissions_update_global on public.guideline_user_permissions;
create policy guideline_user_permissions_update_global
on public.guideline_user_permissions
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists guideline_user_permissions_delete_global on public.guideline_user_permissions;
create policy guideline_user_permissions_delete_global
on public.guideline_user_permissions
for delete
to authenticated
using (public.is_global_planning_manager());

grant select, insert, update, delete on table public.guideline_user_permissions to authenticated;
revoke all on table public.guideline_user_permissions from anon;

-- Preserve current effective non-Central access once when switching models.
-- Any area permission that currently reaches one of a guideline's linked
-- managements becomes an explicit permission for that guideline.
insert into public.guideline_user_permissions (
  authorized_user_id,
  guideline_id,
  can_view,
  can_edit,
  updated_at
)
select
  aup.authorized_user_id,
  g.id,
  bool_or(aup.can_view),
  bool_or(aup.can_view and aup.can_edit),
  now()
from public.planning_guidelines g
join public.area_user_permissions aup
  on aup.unit_code = g.unit_code
 and aup.can_view = true
 and (
   aup.management_id = g.management_id
   or exists (
     select 1
     from public.planning_guideline_managements gm
     where gm.guideline_id = g.id
       and gm.management_id = aup.management_id
   )
 )
where g.unit_code in ('HU', 'VS', 'DEP', 'HOT')
group by aup.authorized_user_id, g.id
on conflict (authorized_user_id, guideline_id) do update
set can_view = public.guideline_user_permissions.can_view or excluded.can_view,
    can_edit = public.guideline_user_permissions.can_edit or excluded.can_edit,
    updated_at = now();

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
      else exists (
        select 1
        from public.profiles p
        where p.user_id = auth.uid()
          and p.active = true
          and (
            p.global_role in ('GESTION_ESTRATEGICA', 'GERENTE_GENERAL')
            or exists (
              select 1
              from public.guideline_user_permissions gup
              where gup.authorized_user_id = p.authorized_user_id
                and gup.guideline_id = g.id
                and gup.can_view = true
            )
          )
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
        else exists (
          select 1
          from public.profiles p
          where p.user_id = auth.uid()
            and p.active = true
            and p.authorized_user_id is not null
            and exists (
              select 1
              from public.guideline_user_permissions gup
              where gup.authorized_user_id = p.authorized_user_id
                and gup.guideline_id = g.id
                and gup.can_view = true
                and gup.can_edit = true
            )
        )
      end
      from public.planning_guidelines g
      where g.id = guideline_id_input
    ), false);
$$;

create or replace function public.can_access_unit(unit_code_input text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.active = true
      and (
        p.global_role in ('GESTION_ESTRATEGICA', 'GERENTE_GENERAL')
        or (
          unit_code_input = 'CENTRAL'
          and (
            exists (
              select 1
              from public.area_user_permissions aup
              where aup.authorized_user_id = p.authorized_user_id
                and aup.unit_code = unit_code_input
                and aup.can_view = true
            )
            or exists (
              select 1
              from public.user_units uu
              where uu.authorized_user_id = p.authorized_user_id
                and uu.unit_code = unit_code_input
                and uu.active = true
            )
          )
        )
        or (
          unit_code_input in ('HU', 'VS', 'DEP', 'HOT')
          and exists (
            select 1
            from public.guideline_user_permissions gup
            join public.planning_guidelines g on g.id = gup.guideline_id
            where gup.authorized_user_id = p.authorized_user_id
              and g.unit_code = unit_code_input
              and g.active = true
              and gup.can_view = true
          )
        )
      )
  );
$$;

revoke execute on function public.can_access_guideline_multi(uuid) from public, anon;
revoke execute on function public.can_edit_guideline_multi(uuid) from public, anon;
revoke execute on function public.can_access_unit(text) from public, anon;
grant execute on function public.can_access_guideline_multi(uuid) to authenticated;
grant execute on function public.can_edit_guideline_multi(uuid) to authenticated;
grant execute on function public.can_access_unit(text) to authenticated;

-- Guidelines: CENTRAL keeps unit + management authorization. Non-Central is
-- visible only through the exact guideline permission (or existing global role).
drop policy if exists planning_guidelines_select_authenticated on public.planning_guidelines;
create policy planning_guidelines_select_authenticated
on public.planning_guidelines
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (
    (
      unit_code = 'CENTRAL'
      and public.can_access_unit(unit_code)
      and public.can_access_management(management_id, unit_code)
    )
    or (
      unit_code <> 'CENTRAL'
      and public.can_access_guideline_multi(id)
    )
  )
);

-- Reading process compatibility metadata through a SECURITY DEFINER helper
-- avoids recursive RLS between processes and matrices.
create or replace function public.can_access_noncentral_process(process_id_input uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.matrices m
    where m.process_id = process_id_input
      and m.unit_code in ('HU', 'VS', 'DEP', 'HOT')
      and m.guideline_id is not null
      and public.can_access_guideline_multi(m.guideline_id)
  );
$$;

revoke execute on function public.can_access_noncentral_process(uuid) from public, anon;
grant execute on function public.can_access_noncentral_process(uuid) to authenticated;

drop policy if exists processes_select_area on public.processes;
create policy processes_select_area
on public.processes
for select
to authenticated
using (
  (
    unit_code = 'CENTRAL'
    and public.can_access_unit(unit_code)
    and public.can_access_management(management_id, unit_code)
  )
  or (
    unit_code <> 'CENTRAL'
    and public.can_access_noncentral_process(id)
  )
);

drop policy if exists processes_insert_area on public.processes;
create policy processes_insert_area
on public.processes
for insert
to authenticated
with check (
  (
    unit_code = 'CENTRAL'
    and public.can_access_unit(unit_code)
    and (public.is_global_planning_manager() or public.can_edit_management(management_id, unit_code))
  )
  or (unit_code <> 'CENTRAL' and public.is_global_planning_manager())
);

drop policy if exists processes_update_area on public.processes;
create policy processes_update_area
on public.processes
for update
to authenticated
using (
  (unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(management_id, unit_code)))
  or (unit_code <> 'CENTRAL' and public.is_global_planning_manager())
)
with check (
  (unit_code = 'CENTRAL' and public.can_access_unit(unit_code) and (public.is_global_planning_manager() or public.can_edit_management(management_id, unit_code)))
  or (unit_code <> 'CENTRAL' and public.is_global_planning_manager())
);

drop policy if exists processes_delete_area on public.processes;
create policy processes_delete_area
on public.processes
for delete
to authenticated
using (
  (unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(management_id, unit_code)))
  or (unit_code <> 'CENTRAL' and public.is_global_planning_manager())
);

-- Matrices: no process/area fallback is allowed for non-Central units.
drop policy if exists matrices_select_area on public.matrices;
create policy matrices_select_area
on public.matrices
for select
to authenticated
using (
  (
    unit_code = 'CENTRAL'
    and public.can_access_unit(unit_code)
    and exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and public.can_access_management(p.management_id, matrices.unit_code)
    )
  )
  or (
    unit_code <> 'CENTRAL'
    and guideline_id is not null
    and public.can_access_guideline_multi(guideline_id)
  )
);

drop policy if exists matrices_insert_area on public.matrices;
create policy matrices_insert_area
on public.matrices
for insert
to authenticated
with check (
  (
    unit_code = 'CENTRAL'
    and public.can_access_unit(unit_code)
    and exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, matrices.unit_code))
    )
  )
  or (
    unit_code <> 'CENTRAL'
    and guideline_id is not null
    and public.can_edit_guideline_multi(guideline_id)
  )
);

drop policy if exists matrices_update_area on public.matrices;
create policy matrices_update_area
on public.matrices
for update
to authenticated
using (
  (
    unit_code = 'CENTRAL'
    and exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, matrices.unit_code))
    )
  )
  or (
    unit_code <> 'CENTRAL'
    and guideline_id is not null
    and public.can_edit_guideline_multi(guideline_id)
  )
)
with check (
  (
    unit_code = 'CENTRAL'
    and public.can_access_unit(unit_code)
    and exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, matrices.unit_code))
    )
  )
  or (
    unit_code <> 'CENTRAL'
    and guideline_id is not null
    and public.can_edit_guideline_multi(guideline_id)
  )
);

drop policy if exists matrices_delete_area on public.matrices;
create policy matrices_delete_area
on public.matrices
for delete
to authenticated
using (
  (
    unit_code = 'CENTRAL'
    and exists (
      select 1 from public.processes p
      where p.id = matrices.process_id
        and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, matrices.unit_code))
    )
  )
  or (
    unit_code <> 'CENTRAL'
    and guideline_id is not null
    and public.can_edit_guideline_multi(guideline_id)
  )
);

-- Rows inherit the matrix branch exactly.
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
      and (
        (
          m.unit_code = 'CENTRAL'
          and public.can_access_unit(m.unit_code)
          and public.can_access_management(p.management_id, m.unit_code)
        )
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_access_guideline_multi(m.guideline_id)
        )
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
        (
          m.unit_code = 'CENTRAL'
          and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code))
        )
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
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
        (
          m.unit_code = 'CENTRAL'
          and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code))
        )
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
    from public.matrices m
    join public.processes p on p.id = m.process_id
    where m.id = matrix_rows.matrix_id
      and (
        (
          m.unit_code = 'CENTRAL'
          and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code))
        )
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
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
        (
          m.unit_code = 'CENTRAL'
          and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code))
        )
        or (
          m.unit_code <> 'CENTRAL'
          and m.guideline_id is not null
          and public.can_edit_guideline_multi(m.guideline_id)
        )
      )
  )
);

-- Central subpoints keep area authorization; non-Central subpoints use the
-- owning matrix guideline only.
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
      and (
        (m.unit_code = 'CENTRAL' and public.can_access_unit(m.unit_code) and public.can_access_management(p.management_id, m.unit_code))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
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
    where r.id = matrix_row_subpoints.matrix_row_id
      and (
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

-- Row responsibles follow the same split.
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
      and (
        (m.unit_code = 'CENTRAL' and public.can_access_unit(m.unit_code) and public.can_access_management(p.management_id, m.unit_code))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
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
        (m.unit_code = 'CENTRAL' and (public.is_global_planning_manager() or public.can_edit_management(p.management_id, m.unit_code)))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_edit_guideline_multi(m.guideline_id))
      )
  )
);

-- History visibility follows the matrix visibility split.
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
        (m.unit_code = 'CENTRAL' and public.can_access_unit(m.unit_code) and public.can_access_management(p.management_id, m.unit_code))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
      )
  )
);

-- Lock acquisition and lock visibility must use the same edit/access split.
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
    (
      v_unit_code = 'CENTRAL'
      and (public.is_global_planning_manager() or public.can_edit_management(v_management_id, v_unit_code))
    )
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

revoke execute on function public.try_lock_matrix_row(uuid) from public, anon;
grant execute on function public.try_lock_matrix_row(uuid) to authenticated;

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
      and (
        (m.unit_code = 'CENTRAL' and public.can_access_unit(m.unit_code) and public.can_access_management(p.management_id, m.unit_code))
        or (m.unit_code <> 'CENTRAL' and m.guideline_id is not null and public.can_access_guideline_multi(m.guideline_id))
      )
  )
);

notify pgrst, 'reload schema';