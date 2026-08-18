-- ============================================================
-- 5S — TESPİT 2: doğru veritabanı mı, satırlar hiç var oldu mu?
-- Yalnızca okur. Supabase SQL Editor'de sorguları TEK TEK çalıştırın
-- (Editor birden fazla sorguda yalnızca birinin sonucunu gösterir).
-- ============================================================

-- 1) BU VERİTABANI UYGULAMANIN KULLANDIĞI MI?
--    Kullanıcılar giriş yapabildiğine göre s5_users DOLU olmalı.
--    Eğer kullanici = 0 ise: uygulama BAŞKA bir Supabase projesine yazıyor,
--    bu proje boş bir kopya demektir (Vercel > Settings > Environment Variables
--    > S5_DATABASE_URL içindeki proje kodunu bu projeninkiyle karşılaştırın).
SELECT current_database()                          AS veritabani,
       (SELECT COUNT(*) FROM s5_users)             AS kullanici,
       (SELECT COUNT(*) FROM s5_areas)             AS alan,
       (SELECT COUNT(*) FROM s5_audits)            AS denetim,
       (SELECT COUNT(*) FROM s5_audit_plans)       AS atama,
       (SELECT COUNT(*) FROM s5_actions)           AS aksiyon,
       (SELECT COUNT(*) FROM s5_form_templates)    AS form_sablonu;

-- 2) DENETİM TABLOSUNA HİÇ SATIR GİRDİ Mİ, SİLİNDİ Mİ?
--    eklenen>0 & silinen>0  → kayıtlar oluştu, sonra SİLİNDİ
--    eklenen=0              → hiç kayıt oluşmadı (INSERT sunucuda hata veriyor)
--    Not: sayaçlar veritabanı yeniden başlatılınca sıfırlanabilir.
SELECT relname AS tablo, n_tup_ins AS eklenen, n_tup_upd AS guncellenen,
       n_tup_del AS silinen, n_live_tup AS mevcut_satir
  FROM pg_stat_user_tables
 WHERE relname LIKE 's5_%'
 ORDER BY relname;

-- 3) EKSİK KOLON TEYİDİ — listede form_template_id YOKSA
--    denetim kaydetme 500 veriyordu demektir (teşhisin kanıtı).
SELECT ordinal_position AS sira, column_name AS kolon, data_type AS tip
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 's5_audits'
 ORDER BY ordinal_position;
