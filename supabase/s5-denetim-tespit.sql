-- ============================================================
-- 5S — KAYIP DENETİM TESPİTİ (yalnızca okur, hiçbir şeyi değiştirmez)
-- Supabase SQL Editor'e yapıştırıp Run edin.
--
-- "Denetim kayboldu" iki farklı şey olabilir:
--   (a) kayıt hiç oluşmadı  → 1. sorgu boş/eksik döner
--   (b) kayıt duruyor ama kullanıcı göremiyor → 3. ve 4. sorgular gösterir
-- ============================================================

-- 1) Son 30 günün tüm denetimleri (kayıt gerçekten var mı?)
SELECT id, date, created_at, area_id, area_name, auditor_id, auditor_name,
       total_score, status, form_code
  FROM s5_audits
 WHERE created_at > now() - interval '30 days'
 ORDER BY created_at DESC;

-- 2) Toplam sayı
SELECT COUNT(*) AS toplam_denetim FROM s5_audits;

-- 3) DENETÇİSİ KOPMUŞ denetimler.
--    Bir kullanıcı silindiğinde auditor_id NULL olur (ON DELETE SET NULL) ve
--    denetim, o denetçinin ekranından kaybolur. Kayıt durur, görünmez.
SELECT id, date, area_name, auditor_name, total_score
  FROM s5_audits
 WHERE auditor_id IS NULL
 ORDER BY date DESC;

-- 4) ALANI SİLİNMİŞ denetimler.
--    Alan silindiğinde area_id NULL olur; fabrika/departman bilgisi kaybolduğu
--    için fabrikaya kısıtlı roller (departman/takimlider) bu denetimleri göremez.
SELECT id, date, area_name, location, auditor_name
  FROM s5_audits
 WHERE area_id IS NULL
 ORDER BY date DESC;

-- 5) Kim hangi denetimi görüyor: denetçi bazında sayım
SELECT COALESCE(u.name, a.auditor_name || ' (hesap silinmiş)') AS denetci,
       COUNT(*) AS denetim_sayisi,
       MAX(a.date) AS son_denetim
  FROM s5_audits a
  LEFT JOIN s5_users u ON u.id = a.auditor_id
 GROUP BY 1
 ORDER BY 2 DESC;
