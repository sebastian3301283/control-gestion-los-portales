-- Harden execution privileges for public-schema functions exposed by PostgREST.
-- Browser roles should only call RPCs that are part of the application contract.
-- Trigger/event-trigger helpers remain internal; is_email_authorized stays available pre-auth.

-- Remove mutable search_path warnings from timestamp trigger helpers.
alter function public.touch_updated_at() set search_path = public;
alter function public.touch_planning_guideline_updated_at() set search_path = public;

-- Pre-auth contract: this is intentionally callable before a Supabase session exists.
revoke execute on function public.is_email_authorized(text) from public, anon, authenticated;
grant execute on function public.is_email_authorized(text) to anon, authenticated, service_role;

-- Authenticated application RPCs. Remove PUBLIC/anon inheritance, then grant explicitly.
revoke execute on function public.activate_matrix_area_for_unit(text, uuid) from public, anon;
grant execute on function public.activate_matrix_area_for_unit(text, uuid) to authenticated, service_role;

revoke execute on function public.can_access_management(uuid, text) from public, anon;
grant execute on function public.can_access_management(uuid, text) to authenticated, service_role;

revoke execute on function public.can_access_unit(text) from public, anon;
grant execute on function public.can_access_unit(text) to authenticated, service_role;

revoke execute on function public.can_edit_management(uuid, text) from public, anon;
grant execute on function public.can_edit_management(uuid, text) to authenticated, service_role;

revoke execute on function public.current_access() from public, anon;
grant execute on function public.current_access() to authenticated, service_role;

revoke execute on function public.current_authorized_user_id() from public, anon;
grant execute on function public.current_authorized_user_id() to authenticated, service_role;

revoke execute on function public.current_profile() from public, anon;
grant execute on function public.current_profile() to authenticated, service_role;

revoke execute on function public.delete_directory_management(uuid) from public, anon;
grant execute on function public.delete_directory_management(uuid) to authenticated, service_role;

revoke execute on function public.delete_directory_manager(uuid) from public, anon;
grant execute on function public.delete_directory_manager(uuid) to authenticated, service_role;

revoke execute on function public.delete_responsibility_catalog_by_unit(text) from public, anon;
grant execute on function public.delete_responsibility_catalog_by_unit(text) to authenticated, service_role;

revoke execute on function public.heartbeat_matrix_row_lock(uuid) from public, anon;
grant execute on function public.heartbeat_matrix_row_lock(uuid) to authenticated, service_role;

revoke execute on function public.is_global_planning_manager() from public, anon;
grant execute on function public.is_global_planning_manager() to authenticated, service_role;

revoke execute on function public.list_area_permission_users() from public, anon;
grant execute on function public.list_area_permission_users() to authenticated, service_role;

revoke execute on function public.release_matrix_row_lock(uuid) from public, anon;
grant execute on function public.release_matrix_row_lock(uuid) to authenticated, service_role;

revoke execute on function public.reset_responsibility_catalog() from public, anon;
grant execute on function public.reset_responsibility_catalog() to authenticated, service_role;

revoke execute on function public.restore_matrix_version_by_context(uuid, text, text, integer) from public, anon;
grant execute on function public.restore_matrix_version_by_context(uuid, text, text, integer) to authenticated, service_role;

revoke execute on function public.save_directory_manager(uuid, text, text, text, text, boolean, uuid[]) from public, anon;
grant execute on function public.save_directory_manager(uuid, text, text, text, text, boolean, uuid[]) to authenticated, service_role;

revoke execute on function public.set_permission_user_role(uuid, text) from public, anon;
grant execute on function public.set_permission_user_role(uuid, text) to authenticated, service_role;

revoke execute on function public.try_lock_matrix_row(uuid) from public, anon;
grant execute on function public.try_lock_matrix_row(uuid) to authenticated, service_role;

-- Internal helpers: they are reached through triggers or trusted SECURITY DEFINER callers,
-- not directly from browser RPC calls.
revoke execute on function public.ensure_default_matrix_for_area(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.ensure_default_matrix_for_area(uuid, text, uuid) to service_role;

revoke execute on function public.capture_matrix_version(uuid, text) from public, anon, authenticated;
grant execute on function public.capture_matrix_version(uuid, text) to service_role;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
grant execute on function public.handle_new_auth_user() to service_role;

revoke execute on function public.matrix_metadata_version_trigger() from public, anon, authenticated;
grant execute on function public.matrix_metadata_version_trigger() to service_role;

revoke execute on function public.matrix_rows_version_trigger() from public, anon, authenticated;
grant execute on function public.matrix_rows_version_trigger() to service_role;

revoke execute on function public.matrix_row_subpoints_version_trigger() from public, anon, authenticated;
grant execute on function public.matrix_row_subpoints_version_trigger() to service_role;

revoke execute on function public.prepare_matrices_for_area_activation() from public, anon, authenticated;
grant execute on function public.prepare_matrices_for_area_activation() to service_role;

revoke execute on function public.prepare_matrices_for_new_period() from public, anon, authenticated;
grant execute on function public.prepare_matrices_for_new_period() to service_role;

revoke execute on function public.sync_authorized_user_to_profile() from public, anon, authenticated;
grant execute on function public.sync_authorized_user_to_profile() to service_role;

revoke execute on function public.sync_guideline_responsible_relations() from public, anon, authenticated;
grant execute on function public.sync_guideline_responsible_relations() to service_role;

revoke execute on function public.sync_user_unit_from_area_permissions() from public, anon, authenticated;
grant execute on function public.sync_user_unit_from_area_permissions() to service_role;

revoke execute on function public.validate_guideline_responsibles() from public, anon, authenticated;
grant execute on function public.validate_guideline_responsibles() to service_role;

revoke execute on function public.validate_management_unit_change() from public, anon, authenticated;
grant execute on function public.validate_management_unit_change() to service_role;

revoke execute on function public.validate_manager_management_unit() from public, anon, authenticated;
grant execute on function public.validate_manager_management_unit() to service_role;

revoke execute on function public.validate_manager_unit_change() from public, anon, authenticated;
grant execute on function public.validate_manager_unit_change() to service_role;

revoke execute on function public.validate_matrix_process_scope() from public, anon, authenticated;
grant execute on function public.validate_matrix_process_scope() to service_role;

revoke execute on function public.validate_process_catalog_scope() from public, anon, authenticated;
grant execute on function public.validate_process_catalog_scope() to service_role;

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;
