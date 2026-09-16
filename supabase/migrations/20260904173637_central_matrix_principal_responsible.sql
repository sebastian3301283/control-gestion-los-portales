alter table public.matrices
  add column if not exists principal_responsible_manager_id uuid null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matrices_principal_responsible_manager_id_fkey'
  ) then
    alter table public.matrices
      add constraint matrices_principal_responsible_manager_id_fkey
      foreign key (principal_responsible_manager_id)
      references public.managers(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_matrices_principal_responsible_manager_id
  on public.matrices(principal_responsible_manager_id);
