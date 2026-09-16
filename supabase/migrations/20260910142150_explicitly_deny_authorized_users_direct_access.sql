revoke all privileges on table public.authorized_users from public, anon, authenticated;

drop policy if exists authorized_users_no_direct_access on public.authorized_users;
create policy authorized_users_no_direct_access
on public.authorized_users
for all
to anon, authenticated
using (false)
with check (false);

comment on policy authorized_users_no_direct_access on public.authorized_users is 'Direct API access is intentionally denied; approved access uses SECURITY DEFINER RPCs.';

notify pgrst, 'reload schema';