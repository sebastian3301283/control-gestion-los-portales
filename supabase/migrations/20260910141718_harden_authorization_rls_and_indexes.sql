-- Defense in depth: authorized_users is only reachable through reviewed SECURITY DEFINER RPCs.
revoke all privileges on table public.authorized_users from anon, authenticated;
revoke execute on function public.is_email_authorized(text) from public;
grant execute on function public.is_email_authorized(text) to anon, authenticated;
comment on function public.is_email_authorized(text) is 'Pre-auth OTP allowlist check. Intentionally executable by anon; authorized_users remains inaccessible directly.';

-- Reduce repeated profile lookups while preserving existing access semantics.
create or replace function public.can_access_management(management_id_input uuid, unit_code_input text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_authorized_user_id uuid;
  v_global_role text;
  v_has_unit_access boolean := false;
  v_has_rules boolean := false;
begin
  if v_uid is null then return false; end if;

  select p.authorized_user_id, p.global_role
    into v_authorized_user_id, v_global_role
  from public.profiles p
  where p.user_id = v_uid
    and p.active = true
  limit 1;

  if not found then return false; end if;
  if v_global_role = 'GESTION_ESTRATEGICA' then return true; end if;
  if v_authorized_user_id is null then return false; end if;

  v_has_unit_access :=
    v_global_role = 'GERENTE_GENERAL'
    or exists (
      select 1
      from public.area_user_permissions aup
      where aup.authorized_user_id = v_authorized_user_id
        and aup.unit_code = unit_code_input
        and aup.can_view = true
    )
    or exists (
      select 1
      from public.user_units uu
      where uu.authorized_user_id = v_authorized_user_id
        and uu.unit_code = unit_code_input
        and uu.active = true
    );

  if not v_has_unit_access then return false; end if;

  select exists (
    select 1
    from public.area_user_permissions aup
    where aup.authorized_user_id = v_authorized_user_id
      and aup.unit_code = unit_code_input
  ) into v_has_rules;

  if not v_has_rules then return true; end if;

  return exists (
    select 1
    from public.area_user_permissions aup
    where aup.authorized_user_id = v_authorized_user_id
      and aup.unit_code = unit_code_input
      and aup.management_id = management_id_input
      and aup.can_view = true
  );
end;
$$;

create or replace function public.can_edit_management(management_id_input uuid, unit_code_input text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_authorized_user_id uuid;
  v_global_role text;
  v_has_unit_access boolean := false;
  v_has_rules boolean := false;
begin
  if v_uid is null then return false; end if;

  select p.authorized_user_id, p.global_role
    into v_authorized_user_id, v_global_role
  from public.profiles p
  where p.user_id = v_uid
    and p.active = true
  limit 1;

  if not found then return false; end if;
  if v_global_role = 'GESTION_ESTRATEGICA' then return true; end if;
  if v_authorized_user_id is null then return false; end if;

  v_has_unit_access :=
    v_global_role = 'GERENTE_GENERAL'
    or exists (
      select 1
      from public.area_user_permissions aup
      where aup.authorized_user_id = v_authorized_user_id
        and aup.unit_code = unit_code_input
        and aup.can_view = true
    )
    or exists (
      select 1
      from public.user_units uu
      where uu.authorized_user_id = v_authorized_user_id
        and uu.unit_code = unit_code_input
        and uu.active = true
    );

  if not v_has_unit_access then return false; end if;

  select exists (
    select 1
    from public.area_user_permissions aup
    where aup.authorized_user_id = v_authorized_user_id
      and aup.unit_code = unit_code_input
  ) into v_has_rules;

  if not v_has_rules then return false; end if;

  return exists (
    select 1
    from public.area_user_permissions aup
    where aup.authorized_user_id = v_authorized_user_id
      and aup.unit_code = unit_code_input
      and aup.management_id = management_id_input
      and aup.can_view = true
      and aup.can_edit = true
  );
end;
$$;

-- Initplan-friendly policies.
drop policy if exists users_can_read_own_profile on public.profiles;
create policy users_can_read_own_profile on public.profiles
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists users_can_read_own_unit_assignments on public.user_units;
create policy users_can_read_own_unit_assignments on public.user_units
for select to authenticated
using (exists (
  select 1 from public.profiles p
  where p.user_id = (select auth.uid())
    and p.authorized_user_id = user_units.authorized_user_id
    and p.active = true
));

drop policy if exists managements_global_select_authenticated on public.managements_global;
create policy managements_global_select_authenticated on public.managements_global
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists manager_managements_select_authenticated on public.manager_managements;
create policy manager_managements_select_authenticated on public.manager_managements
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists managers_select_authenticated on public.managers;
create policy managers_select_authenticated on public.managers
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists matrix_area_catalog_select on public.matrix_area_catalog;
create policy matrix_area_catalog_select on public.matrix_area_catalog
for select to authenticated using ((select auth.uid()) is not null);

drop policy if exists matrix_area_selections_insert on public.matrix_area_selections;
create policy matrix_area_selections_insert on public.matrix_area_selections
for insert to authenticated with check (public.is_global_planning_manager());

drop policy if exists matrix_area_selections_update on public.matrix_area_selections;
create policy matrix_area_selections_update on public.matrix_area_selections
for update to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

drop policy if exists matrix_area_selections_delete on public.matrix_area_selections;
create policy matrix_area_selections_delete on public.matrix_area_selections
for delete to authenticated using (public.is_global_planning_manager());

-- Replace broad ALL management policies with operation-specific write policies.
drop policy if exists guideline_managements_manage_global on public.guideline_managements;
create policy guideline_managements_insert_global on public.guideline_managements for insert to authenticated with check (public.is_global_planning_manager());
create policy guideline_managements_update_global on public.guideline_managements for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy guideline_managements_delete_global on public.guideline_managements for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists guideline_managers_manage_global on public.guideline_managers;
create policy guideline_managers_insert_global on public.guideline_managers for insert to authenticated with check (public.is_global_planning_manager());
create policy guideline_managers_update_global on public.guideline_managers for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy guideline_managers_delete_global on public.guideline_managers for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists guideline_unit_area_catalog_manage on public.guideline_unit_area_catalog;
create policy guideline_unit_area_catalog_insert on public.guideline_unit_area_catalog for insert to authenticated with check (public.is_global_planning_manager());
create policy guideline_unit_area_catalog_update on public.guideline_unit_area_catalog for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy guideline_unit_area_catalog_delete on public.guideline_unit_area_catalog for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists managements_global_manage_gestion on public.managements_global;
create policy managements_global_insert_gestion on public.managements_global for insert to authenticated with check (public.is_global_planning_manager());
create policy managements_global_update_gestion on public.managements_global for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy managements_global_delete_gestion on public.managements_global for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists manager_managements_manage_global on public.manager_managements;
create policy manager_managements_insert_global on public.manager_managements for insert to authenticated with check (public.is_global_planning_manager());
create policy manager_managements_update_global on public.manager_managements for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy manager_managements_delete_global on public.manager_managements for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists managers_manage_global on public.managers;
create policy managers_insert_global on public.managers for insert to authenticated with check (public.is_global_planning_manager());
create policy managers_update_global on public.managers for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy managers_delete_global on public.managers for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists matrix_area_catalog_manage on public.matrix_area_catalog;
create policy matrix_area_catalog_insert on public.matrix_area_catalog for insert to authenticated with check (public.is_global_planning_manager());
create policy matrix_area_catalog_update on public.matrix_area_catalog for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy matrix_area_catalog_delete on public.matrix_area_catalog for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists matrix_unit_area_catalog_manage on public.matrix_unit_area_catalog;
create policy matrix_unit_area_catalog_insert on public.matrix_unit_area_catalog for insert to authenticated with check (public.is_global_planning_manager());
create policy matrix_unit_area_catalog_update on public.matrix_unit_area_catalog for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy matrix_unit_area_catalog_delete on public.matrix_unit_area_catalog for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists planning_guidelines_manage_global on public.planning_guidelines;
create policy planning_guidelines_insert_global on public.planning_guidelines for insert to authenticated with check (public.is_global_planning_manager());
create policy planning_guidelines_update_global on public.planning_guidelines for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy planning_guidelines_delete_global on public.planning_guidelines for delete to authenticated using (public.is_global_planning_manager());

drop policy if exists planning_periods_manage_global on public.planning_periods;
create policy planning_periods_insert_global on public.planning_periods for insert to authenticated with check (public.is_global_planning_manager());
create policy planning_periods_update_global on public.planning_periods for update to authenticated using (public.is_global_planning_manager()) with check (public.is_global_planning_manager());
create policy planning_periods_delete_global on public.planning_periods for delete to authenticated using (public.is_global_planning_manager());

-- Reverse-FK / relation indexes used by catalogue and planning joins.
create index if not exists guideline_managements_management_idx on public.guideline_managements (management_id, guideline_id);
create index if not exists guideline_managers_manager_idx on public.guideline_managers (manager_id, guideline_id);
create index if not exists manager_managements_management_idx on public.manager_managements (management_id, manager_id);
create index if not exists matrix_unit_area_catalog_management_idx on public.matrix_unit_area_catalog (management_id, unit_code);
create index if not exists guideline_unit_area_catalog_management_idx on public.guideline_unit_area_catalog (management_id, unit_code);
create index if not exists planning_guidelines_management_idx on public.planning_guidelines (management_id);
create index if not exists planning_guidelines_responsible_manager_idx on public.planning_guidelines (responsible_manager_id);
create index if not exists planning_guidelines_unit_idx on public.planning_guidelines (unit_code, period_id);

notify pgrst, 'reload schema';