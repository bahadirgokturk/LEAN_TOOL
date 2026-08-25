-- Lean Docs: Kaizen, standard operation forms and shared libraries.
-- Records stay compact in Postgres; photos belong in the private Storage bucket.

create or replace function public.is_lean_docs_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'lean_docs_admin', false)
    or coalesce((auth.jwt() -> 'app_metadata' -> 'roles') ? 'lean_docs_admin', false);
$$;

revoke all on function public.is_lean_docs_admin() from public;
grant execute on function public.is_lean_docs_admin() to authenticated;

create or replace function public.has_lean_tool_access()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'access_approved') = 'true', false);
$$;

revoke all on function public.has_lean_tool_access() from public;
grant execute on function public.has_lean_tool_access() to authenticated;

create table if not exists public.lean_doc_records (
  id text primary key,
  record_type text not null check (
    record_type in ('point_kaizen', 'rollout_kaizen', 'operation_standard', 'equipment', 'ppe')
  ),
  document_no text,
  title text not null default '',
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  updated_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lean_doc_records_type_updated_idx
  on public.lean_doc_records (record_type, updated_at desc);
create index if not exists lean_doc_records_created_by_idx
  on public.lean_doc_records (created_by);

alter table public.lean_doc_records enable row level security;

revoke all on table public.lean_doc_records from anon, authenticated;
grant select, delete on table public.lean_doc_records to authenticated;
grant insert (id, record_type, document_no, title, payload, created_by, updated_by, version, created_at, updated_at)
  on public.lean_doc_records to authenticated;
grant update (record_type, document_no, title, payload, updated_by, version, updated_at)
  on public.lean_doc_records to authenticated;

drop policy if exists "lean docs shared read" on public.lean_doc_records;
drop policy if exists "lean docs authenticated create" on public.lean_doc_records;
drop policy if exists "lean docs owner or admin update" on public.lean_doc_records;
drop policy if exists "lean docs owner or admin delete" on public.lean_doc_records;

create policy "lean docs shared read" on public.lean_doc_records
  for select to authenticated using ((select public.has_lean_tool_access()));

create policy "lean docs authenticated create" on public.lean_doc_records
  for insert to authenticated
  with check (
    (select public.has_lean_tool_access())
    and created_by = (select auth.uid())
    and updated_by = (select auth.uid())
  );

create policy "lean docs owner or admin update" on public.lean_doc_records
  for update to authenticated
  using (
    (select public.has_lean_tool_access())
    and (created_by = (select auth.uid()) or (select public.is_lean_docs_admin()))
  )
  with check ((select public.has_lean_tool_access()) and updated_by = (select auth.uid()));

create policy "lean docs owner or admin delete" on public.lean_doc_records
  for delete to authenticated
  using (
    (select public.has_lean_tool_access())
    and (created_by = (select auth.uid()) or (select public.is_lean_docs_admin()))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lean-doc-media',
  'lean-doc-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "lean docs media shared read" on storage.objects;
drop policy if exists "lean docs media owner upload" on storage.objects;
drop policy if exists "lean docs media owner or admin update" on storage.objects;
drop policy if exists "lean docs media owner or admin delete" on storage.objects;

create policy "lean docs media shared read" on storage.objects
  for select to authenticated
  using (bucket_id = 'lean-doc-media' and (select public.has_lean_tool_access()));

create policy "lean docs media owner upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lean-doc-media'
    and (select public.has_lean_tool_access())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "lean docs media owner or admin update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'lean-doc-media'
    and (select public.has_lean_tool_access())
    and (
      owner_id = (select auth.uid())::text
      or (select public.is_lean_docs_admin())
    )
  )
  with check (bucket_id = 'lean-doc-media' and (select public.has_lean_tool_access()));

create policy "lean docs media owner or admin delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'lean-doc-media'
    and (select public.has_lean_tool_access())
    and (
      owner_id = (select auth.uid())::text
      or (select public.is_lean_docs_admin())
    )
  );
