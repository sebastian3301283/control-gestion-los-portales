create or replace function public.save_planning_guideline_multi(
  guideline_id_input uuid,
  period_id_input uuid,
  unit_code_input text,
  management_ids_input uuid[],
  category_input text,
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
begin
  v_guideline_id := public.save_planning_guideline_multi(
    guideline_id_input,
    period_id_input,
    unit_code_input,
    management_ids_input,
    code_input,
    guideline_text_input,
    responsible_ids_input,
    active_input
  );

  update public.planning_guidelines
  set category = nullif(btrim(category_input), '')
  where id = v_guideline_id;

  return v_guideline_id;
end;
$$;

revoke execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], text, text, text, uuid[], boolean) from public, anon;
grant execute on function public.save_planning_guideline_multi(uuid, uuid, text, uuid[], text, text, text, uuid[], boolean) to authenticated;

notify pgrst, 'reload schema';
