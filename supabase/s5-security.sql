-- ============================================================
-- 5S — GÜVENLİK SERTLEŞTİRME
-- Saueressig Türkiye · OPEX
--
-- KULLANIM: PM/5S Supabase projesinde (xsaislwzxajbsutxnpzc)
-- SQL Editor'e yapıştırıp Run edin. Tekrar çalıştırmak güvenlidir.
--
-- NE YAPAR:
--   1. Brute-force koruması için hesap kilitleme alanları ekler
--   2. Varsayılan şifreli hesapları "şifre değiştirmeli" olarak işaretler
--   3. Varsayılan şifreleri geçersiz kılar (rastgele değerle ezer)
-- ============================================================

-- 1) BRUTE-FORCE KORUMASI + ZORUNLU ŞİFRE DEĞİŞİMİ ALANLARI
alter table s5_users add column if not exists failed_attempts int not null default 0;
alter table s5_users add column if not exists locked_until timestamptz;
alter table s5_users add column if not exists must_change_password boolean not null default false;

-- 2) VARSAYILAN ŞİFRELERİ GEÇERSİZ KIL
--    Seed şifreleri (admin123, bah123, izm123 ...) herkese açık repoda yazılı
--    olduğu için tamamı güvenlik açığıdır. Bu blok, hâlâ varsayılan şifreyi
--    kullanan hesapların şifresini TAHMİN EDİLEMEZ rastgele bir değerle ezer.
--    Sonrasında her hesaba yeni şifre atamanız gerekir (aşağıdaki ADIM 3).
do $$
declare
  rec record;
  defaults jsonb := jsonb_build_object(
    'admin','admin123', 'bahadir','bah123', 'furkan','fur123',
    'izmir','izm123', 'operasyon','ops123', 'ofis','ofi123',
    'esbas','esb123', 'ispak','isp123', 'karaman','kar123'
  );
begin
  for rec in select username, password_hash from s5_users loop
    if defaults ? rec.username
       and rec.password_hash = crypt(defaults->>rec.username, rec.password_hash)
    then
      update s5_users
         set password_hash = crypt(gen_random_uuid()::text, gen_salt('bf', 10)),
             must_change_password = true
       where username = rec.username;
      raise notice 'Varsayilan sifre geçersiz kilindi: %', rec.username;
    end if;
  end loop;
end $$;

-- ============================================================
-- ADIM 3 — YENİ ŞİFRELERİ SİZ BELİRLEYİN (zorunlu)
--
-- Yukarıdaki blok varsayılan şifreleri kullanılamaz hale getirdi. Şimdi her
-- aktif hesaba GÜÇLÜ bir şifre atayın. Aşağıdaki satırları kopyalayıp
-- 'YENI_GUCLU_SIFRE' yerine kendi belirlediğiniz şifreyi yazın ve çalıştırın.
-- (En az 10 karakter, büyük/küçük harf + rakam önerilir.)
--
-- update s5_users set password_hash = crypt('YENI_GUCLU_SIFRE', gen_salt('bf',10)),
--        must_change_password = false, failed_attempts = 0, locked_until = null
--  where username = 'admin';
--
-- update s5_users set password_hash = crypt('BASKA_GUCLU_SIFRE', gen_salt('bf',10)),
--        must_change_password = false, failed_attempts = 0, locked_until = null
--  where username = 'bahadir';
--
-- ... her kullanıcı için tekrarlayın.
--
-- KONTROL — hangi hesaplar hâlâ şifre değişimi bekliyor:
--   select username, name, must_change_password from s5_users order by username;
-- ============================================================
