-- ============================================================
-- 5S — Fotoğraf depolama (Supabase Storage) bucket + izinleri
-- Saueressig Türkiye · OPEX
--
-- KULLANIM: Bu dosyanın TAMAMINI, 5S'in veritabanının bulunduğu
-- PM/5S Supabase projesinde (xsaislwzxajbsutxnpzc) SQL Editor'e
-- yapıştırıp Run edin. Tekrar çalıştırmak güvenlidir.
--
-- NEDEN: Denetim fotoğrafları önceden base64 olarak istek gövdesine
-- gömülüyordu ve Vercel'in ~4.5 MB sınırını aşınca kayıt kayboluyordu.
-- Artık fotoğraflar doğrudan bu bucket'a yüklenir, denetimde sadece URL durur.
-- ============================================================

-- 1) BUCKET (public: fotoğraflar admin panelinde <img src> ile görüntülenecek)
insert into storage.buckets (id, name, public)
values ('s5-photos', 's5-photos', true)
on conflict (id) do nothing;

-- 2) YÜKLEME İZNİ — anon (5S kendi JWT auth'unu kullanır, Supabase Auth değil;
--    bu yüzden publishable/anon anahtar ile yükleme yapılır. Sadece bu bucket'a.)
drop policy if exists "s5 anon upload" on storage.objects;
create policy "s5 anon upload"
on storage.objects for insert
to anon
with check (bucket_id = 's5-photos');

-- 3) OKUMA İZNİ — herkese açık okuma (görüntüleme için)
drop policy if exists "s5 public read" on storage.objects;
create policy "s5 public read"
on storage.objects for select
to public
using (bucket_id = 's5-photos');

-- 4) YÖNETİM İZNİ — giriş yapmış Supabase kullanıcıları (PM tarafı) yönetebilsin
drop policy if exists "s5 auth manage" on storage.objects;
create policy "s5 auth manage"
on storage.objects for all
to authenticated
using (bucket_id = 's5-photos')
with check (bucket_id = 's5-photos');

-- NOT: Bu politikalar yalnızca bucket_id='s5-photos' için geçerlidir; PM'in
-- kendi bucket'larını (varsa) etkilemez.
