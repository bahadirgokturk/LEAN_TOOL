-- Yalın Tool access approval workflow.
create schema if not exists private;

create table if not exists public.lean_tool_access_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  approved boolean not null default false,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id)
);
alter table public.lean_tool_access_requests enable row level security;
revoke all on public.lean_tool_access_requests from anon, authenticated;
grant select on public.lean_tool_access_requests to authenticated;
grant update (approved) on public.lean_tool_access_requests to authenticated;

create or replace function private.is_lean_tool_access_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select (raw_app_meta_data -> 'roles') ? 'lean_tool_access_admin'
  from auth.users where id = auth.uid()), false) $$;
revoke all on function private.is_lean_tool_access_admin() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_lean_tool_access_admin() to authenticated;

drop policy if exists "access admins can read requests" on public.lean_tool_access_requests;
create policy "access admins can read requests" on public.lean_tool_access_requests
  for select to authenticated using (private.is_lean_tool_access_admin());
drop policy if exists "access admins can update requests" on public.lean_tool_access_requests;
create policy "access admins can update requests" on public.lean_tool_access_requests
  for update to authenticated using (private.is_lean_tool_access_admin())
  with check (private.is_lean_tool_access_admin());

create or replace function public.sync_lean_tool_access_request()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lean_tool_access_requests(user_id, email, approved, requested_at, approved_at)
  values (new.id, coalesce(new.email, ''),
    coalesce((new.raw_app_meta_data ->> 'access_approved')::boolean, false),
    coalesce(new.created_at, now()),
    case when coalesce((new.raw_app_meta_data ->> 'access_approved')::boolean, false) then now() end)
  on conflict (user_id) do update set email = excluded.email;
  return new;
end $$;
revoke all on function public.sync_lean_tool_access_request() from public, anon, authenticated;
drop trigger if exists sync_lean_tool_access_request_on_auth_user on auth.users;
create trigger sync_lean_tool_access_request_on_auth_user
  after insert or update of email on auth.users
  for each row execute function public.sync_lean_tool_access_request();

create or replace function public.apply_lean_tool_access_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.approved is distinct from old.approved then
    if not private.is_lean_tool_access_admin() then raise exception 'Access denied'; end if;
    update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('access_approved', new.approved)
      where id = new.user_id;
    new.approved_by := auth.uid();
    new.approved_at := case when new.approved then now() end;
  end if;
  return new;
end $$;
revoke all on function public.apply_lean_tool_access_approval() from public, anon, authenticated;
drop trigger if exists apply_lean_tool_access_approval_on_request on public.lean_tool_access_requests;
create trigger apply_lean_tool_access_approval_on_request
  before update of approved on public.lean_tool_access_requests
  for each row execute function public.apply_lean_tool_access_approval();

insert into public.lean_tool_access_requests(user_id, email, approved, requested_at, approved_at)
select id, coalesce(email, ''),
  coalesce((raw_app_meta_data ->> 'access_approved')::boolean, false),
  created_at,
  case when coalesce((raw_app_meta_data ->> 'access_approved')::boolean, false) then now() end
from auth.users
on conflict (user_id) do update set email = excluded.email;
