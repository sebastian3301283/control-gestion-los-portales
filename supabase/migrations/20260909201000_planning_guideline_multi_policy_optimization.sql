-- Optimize the new multi-ownership RLS policies without changing their access semantics.
-- Keep one SELECT policy per relation table, and split global writes by command so
-- PostgreSQL does not evaluate two permissive SELECT policies for every read.

drop policy if exists planning_guideline_managements_manage_global on public.planning_guideline_managements;
drop policy if exists planning_guideline_managements_insert_global on public.planning_guideline_managements;
drop policy if exists planning_guideline_managements_update_global on public.planning_guideline_managements;
drop policy if exists planning_guideline_managements_delete_global on public.planning_guideline_managements;

create policy planning_guideline_managements_insert_global
on public.planning_guideline_managements
for insert
to authenticated
with check (public.is_global_planning_manager());

create policy planning_guideline_managements_update_global
on public.planning_guideline_managements
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

create policy planning_guideline_managements_delete_global
on public.planning_guideline_managements
for delete
to authenticated
using (public.is_global_planning_manager());

drop policy if exists planning_guideline_responsibles_manage_global on public.planning_guideline_responsibles;
drop policy if exists planning_guideline_responsibles_insert_global on public.planning_guideline_responsibles;
drop policy if exists planning_guideline_responsibles_update_global on public.planning_guideline_responsibles;
drop policy if exists planning_guideline_responsibles_delete_global on public.planning_guideline_responsibles;

create policy planning_guideline_responsibles_insert_global
on public.planning_guideline_responsibles
for insert
to authenticated
with check (public.is_global_planning_manager());

create policy planning_guideline_responsibles_update_global
on public.planning_guideline_responsibles
for update
to authenticated
using (public.is_global_planning_manager())
with check (public.is_global_planning_manager());

create policy planning_guideline_responsibles_delete_global
on public.planning_guideline_responsibles
for delete
to authenticated
using (public.is_global_planning_manager());

-- Initialize auth.uid() once per statement instead of once per candidate row.
drop policy if exists planning_guidelines_select_authenticated on public.planning_guidelines;
create policy planning_guidelines_select_authenticated
on public.planning_guidelines
for select
to authenticated
using (
  (select auth.uid()) is not null
  and public.can_access_unit(unit_code)
  and (
    (unit_code = 'CENTRAL' and public.can_access_management(management_id, unit_code))
    or (unit_code <> 'CENTRAL' and public.can_access_guideline_multi(id))
  )
);
