-- Gemba data and authorization on the central Yalin Tool Supabase project.
-- Existing findings were copied separately because they are production data;
-- their old public media URLs remain valid while new media uses this project.

create schema if not exists private;

create table if not exists public.gemba_findings (
  id uuid primary key default gen_random_uuid(),
  area text not null,
  responsible text not null,
  photo_url text not null,
  created_at timestamptz not null default now(),
  reason text not null default '',
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  description text,
  submission_id uuid,
  status text check (status is null or status in ('yapildi', 'yapilmadi')),
  status_changed_at timestamptz
);

create table if not exists public.gemba_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.gemba_responsibles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.gemba_reasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

alter table public.gemba_findings enable row level security;
alter table public.gemba_areas enable row level security;
alter table public.gemba_responsibles enable row level security;
alter table public.gemba_reasons enable row level security;

create or replace function private.is_gemba_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select raw_app_meta_data -> 'roles' ? 'gemba_admin'
       from auth.users where id = auth.uid()),
    false
  );
$$;

revoke all on function private.is_gemba_admin() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_gemba_admin() to authenticated;

drop policy if exists "gemba public submit" on public.gemba_findings;
create policy "gemba public submit" on public.gemba_findings
  for insert to anon with check (true);
drop policy if exists "gemba admin manage findings" on public.gemba_findings;
create policy "gemba admin manage findings" on public.gemba_findings
  for all to authenticated using (private.is_gemba_admin()) with check (private.is_gemba_admin());

do $$
declare table_name text;
begin
  foreach table_name in array array['gemba_areas', 'gemba_responsibles', 'gemba_reasons'] loop
    execute format('drop policy if exists "gemba public read" on public.%I', table_name);
    execute format('create policy "gemba public read" on public.%I for select to anon using (true)', table_name);
    execute format('drop policy if exists "gemba admin manage" on public.%I', table_name);
    execute format('create policy "gemba admin manage" on public.%I for all to authenticated using (private.is_gemba_admin()) with check (private.is_gemba_admin())', table_name);
  end loop;
end $$;

insert into public.gemba_areas (name) values
  ('Çelik Üretim Hattı'), ('Destek Üretim Hattı'), ('Flexible Hattı'), ('Giriş Depo'),
  ('İdari Bina'), ('Kalite Kontrol'), ('Otomatik Hat'), ('Sevkiyat'), ('Tobacco Hattı')
on conflict (name) do nothing;

insert into public.gemba_responsibles (name) values
  ('Bakım'), ('İdari İşler'), ('İnsan Kaynakları'), ('Kalite'), ('OPEX'),
  ('Planlama'), ('Repro'), ('Satış'), ('Üretim')
on conflict (name) do nothing;

insert into public.gemba_reasons (name) values
  ('5S ve Görsel Yönetim'), ('Ekipman ve Bakım'), ('İş Sağlığı ve Güvenliği'),
  ('Kalite ve Standartlar'), ('Malzeme ve Stok Yönetimi'), ('Temizlik ve Düzen')
on conflict (name) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gemba-photos', 'gemba-photos', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "gemba public media upload" on storage.objects;
create policy "gemba public media upload" on storage.objects
  for insert to anon with check (bucket_id = 'gemba-photos');
drop policy if exists "gemba admin manage media" on storage.objects;
create policy "gemba admin manage media" on storage.objects
  for all to authenticated
  using (bucket_id = 'gemba-photos' and private.is_gemba_admin())
  with check (bucket_id = 'gemba-photos' and private.is_gemba_admin());
