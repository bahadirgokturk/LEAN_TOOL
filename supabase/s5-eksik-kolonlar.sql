-- ============================================================
-- 5S — EKSİK KOLONLARI TAMAMLAMA (onarım betiği)
-- Saueressig Türkiye · OPEX
--
-- KULLANIM: Supabase SQL Editor'e yapıştırıp Run edin.
-- Tekrar çalıştırmak güvenlidir; hiçbir veriyi silmez veya değiştirmez.
--
-- NEDEN VAR: Uygulama kodu Vercel'e her push'ta otomatik dağıtılır, ancak
-- supabase/ altındaki SQL dosyaları elle çalıştırılır. Arada kalan sürede yeni
-- kolonu kullanan işlem "Sunucu hatası" verir. Denetim kaydetmenin durmasının
-- nedeni buydu. Bu dosya, koda ait TÜM opsiyonel kolonları tek seferde ekler.
-- ============================================================

-- Denetimin hangi soru setiyle doldurulduğu (s5-form-active.sql).
-- Bu kolon yokken POST /api/s5/audits 500 döner ve denetim KAYDEDİLMEZ.
ALTER TABLE s5_audits
  ADD COLUMN IF NOT EXISTS form_template_id text;

-- Varsayılan form şablonu işareti (s5-form-active.sql).
ALTER TABLE s5_form_templates
  ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS s5_form_templates_tek_aktif
  ON s5_form_templates (aktif)
  WHERE aktif = true;

-- Form şablonunun bağlı olduğu QR tipi (s5-form-tipi.sql).
ALTER TABLE s5_form_templates
  ADD COLUMN IF NOT EXISTS form_tipi text;

CREATE UNIQUE INDEX IF NOT EXISTS s5_form_templates_tek_tip
  ON s5_form_templates (form_tipi)
  WHERE form_tipi IS NOT NULL;

-- Brute-force kilitleme ve zorunlu şifre değişimi (s5-security.sql).
ALTER TABLE s5_users ADD COLUMN IF NOT EXISTS failed_attempts int NOT NULL DEFAULT 0;
ALTER TABLE s5_users ADD COLUMN IF NOT EXISTS locked_until timestamptz;
ALTER TABLE s5_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- Kontrol: aşağıdaki sorgu 6 satır dönmelidir.
SELECT table_name, column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND (table_name, column_name) IN (
        ('s5_audits','form_template_id'),
        ('s5_form_templates','aktif'),
        ('s5_form_templates','form_tipi'),
        ('s5_users','failed_attempts'),
        ('s5_users','locked_until'),
        ('s5_users','must_change_password')
   )
 ORDER BY table_name, column_name;
