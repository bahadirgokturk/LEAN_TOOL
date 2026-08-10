-- Gemba admin authorization hardening.
-- Assign `gemba_admin` in app_metadata to intended administrators before rollout.
-- Never use user_metadata as an authorization source because users can edit it.

create or replace function public.is_gemba_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'gemba_admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'gemba_admin', false);
$$;

revoke all on function public.is_gemba_admin() from public;
grant execute on function public.is_gemba_admin() to authenticated;

-- This SECURITY DEFINER maintenance RPC reads a Vault service key and deletes
-- expired findings. It is invoked by pg_cron as postgres and must never be
-- callable from the public API by anonymous or ordinary signed-in users.
revoke all on function public.gemba_cleanup_old_findings() from public, anon, authenticated;
grant execute on function public.gemba_cleanup_old_findings() to service_role;

alter table public.gemba_findings enable row level security;
alter table public.gemba_areas enable row level security;
alter table public.gemba_responsibles enable row level security;
alter table public.gemba_reasons enable row level security;

-- Keep table-level privileges as narrow as the public form requires. RLS is the
-- row-level gate; these grants provide an additional least-privilege boundary.
revoke all on table public.gemba_findings from anon, authenticated;
revoke all on table public.gemba_areas from anon, authenticated;
revoke all on table public.gemba_responsibles from anon, authenticated;
revoke all on table public.gemba_reasons from anon, authenticated;

grant insert on table public.gemba_findings to anon;
grant select, insert, update, delete on table public.gemba_findings to authenticated;
grant select on table public.gemba_areas, public.gemba_responsibles, public.gemba_reasons to anon;
grant select, insert, update, delete on table public.gemba_areas, public.gemba_responsibles, public.gemba_reasons to authenticated;

-- Replace every table policy so an older permissive policy cannot keep granting
-- access alongside the new fail-closed policies.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('gemba_findings', 'gemba_areas', 'gemba_responsibles', 'gemba_reasons')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

-- Anonymous Gemba walks may submit findings, but only admins may read/change them.
create policy "gemba anonymous submit findings" on public.gemba_findings
  for insert to anon with check (true);
create policy "gemba admin submit findings" on public.gemba_findings
  for insert to authenticated with check (public.is_gemba_admin());
create policy "gemba admin read findings" on public.gemba_findings
  for select to authenticated using (public.is_gemba_admin());
create policy "gemba admin update findings" on public.gemba_findings
  for update to authenticated using (public.is_gemba_admin()) with check (public.is_gemba_admin());
create policy "gemba admin delete findings" on public.gemba_findings
  for delete to authenticated using (public.is_gemba_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['gemba_areas', 'gemba_responsibles', 'gemba_reasons'] loop
    execute format(
      'create policy "gemba public read %1$s" on public.%1$I for select to anon, authenticated using (true)',
      table_name
    );
    execute format(
      'create policy "gemba admin insert %1$s" on public.%1$I for insert to authenticated with check (public.is_gemba_admin())',
      table_name
    );
    execute format(
      'create policy "gemba admin update %1$s" on public.%1$I for update to authenticated using (public.is_gemba_admin()) with check (public.is_gemba_admin())',
      table_name
    );
    execute format(
      'create policy "gemba admin delete %1$s" on public.%1$I for delete to authenticated using (public.is_gemba_admin())',
      table_name
    );
  end loop;
end $$;

do $$
declare policy_row record;
begin
  for policy_row in
    select policyname
      from pg_policies
     where schemaname = 'storage'
       and tablename = 'objects'
       and (
         policyname ilike '%gemba%'
         or coalesce(qual, '') like '%gemba-photos%'
         or coalesce(with_check, '') like '%gemba-photos%'
       )
  loop
    execute format('drop policy %I on storage.objects', policy_row.policyname);
  end loop;
end $$;

create policy "gemba anonymous upload photos" on storage.objects
  for insert to anon
  with check (bucket_id = 'gemba-photos');
create policy "gemba admin manage photos" on storage.objects
  for all to authenticated
  using (bucket_id = 'gemba-photos' and public.is_gemba_admin())
  with check (bucket_id = 'gemba-photos' and public.is_gemba_admin());

-- Bootstrap example (replace the address and run once):
-- update auth.users
-- set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--   || '{"role":"gemba_admin"}'::jsonb
-- where email = 'your-admin@example.com';
