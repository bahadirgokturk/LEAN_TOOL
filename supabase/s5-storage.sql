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
values ('s5-photos', 's5-photos', false)
on conflict (id) do nothing;

update storage.buckets
set public = false,
    file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 's5-photos';

-- 2) YÜKLEME İZNİ — anon (5S kendi JWT auth'unu kullanır, Supabase Auth değil;
--    bu yüzden publishable/anon anahtar ile yükleme yapılır. Sadece bu bucket'a.)
drop policy if exists "s5 anon upload" on storage.objects;

-- 3) OKUMA İZNİ — herkese açık okuma (görüntüleme için)
drop policy if exists "s5 public read" on storage.objects;

-- 4) YÖNETİM İZNİ — giriş yapmış Supabase kullanıcıları (PM tarafı) yönetebilsin
drop policy if exists "s5 auth manage" on storage.objects;

-- Yükleme yalnızca /api/s5/photos üzerinden service-role ile yapılır. Service
-- role RLS'i güvenli sunucu sınırında bypass eder; anon/authenticated istemciye
-- insert, update veya delete politikası verilmez.

-- 5) ESKİ KAYITLAR — önceden saklanan herkese açık Supabase URL'lerini,
-- oturum kontrollü uygulama adresine dönüştür. JSON yapısı korunur.
update public.s5_audits
set photos_json = regexp_replace(
  photos_json::text,
  'https://[^" ]+/storage/v1/object/public/s5-photos/',
  '/api/s5/photos?path=',
  'g'
)::jsonb
where photos_json::text like '%/storage/v1/object/public/s5-photos/%';

-- NOT: Bu politikalar yalnızca bucket_id='s5-photos' için geçerlidir; PM'in
-- kendi bucket'larını (varsa) etkilemez.
