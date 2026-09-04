alter table public.matrix_rows
  add column if not exists guideline_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'matrix_rows_guideline_id_fkey'
      and conrelid = 'public.matrix_rows'::regclass
  ) then
    alter table public.matrix_rows
      add constraint matrix_rows_guideline_id_fkey
      foreign key (guideline_id)
      references public.planning_guidelines(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_matrix_rows_guideline_id
  on public.matrix_rows(guideline_id);

update public.matrix_rows mr
set guideline_id = pg.id
from public.matrices m
join public.processes p on p.id = m.process_id
join public.planning_guidelines pg
  on pg.period_id = m.period_id
 and pg.unit_code = m.unit_code
 and pg.management_id = p.management_id
 and pg.active = true
where mr.matrix_id = m.id
  and m.unit_code = 'CENTRAL'
  and mr.guideline_id is null
  and nullif(btrim(mr.objective_group), '') is not null
  and lower(btrim(pg.guideline_text)) = lower(btrim(mr.objective_group));
