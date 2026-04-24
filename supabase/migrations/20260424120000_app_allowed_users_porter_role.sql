alter table public.app_allowed_users
drop constraint if exists app_allowed_users_role_check;

alter table public.app_allowed_users
add constraint app_allowed_users_role_check
check (role in ('admin', 'staff', 'viewer', 'porter'));
