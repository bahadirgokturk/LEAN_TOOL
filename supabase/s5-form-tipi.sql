-- ============================================================
-- 5S — FORM TİPİNE GÖRE SORU SETİ
-- Supabase SQL Editor'de bir kez çalıştırın (tekrar çalıştırılabilir).
--
-- NE İŞE YARAR: Bir form şablonu artık bir QR tipine bağlanabilir
-- (uretim / operasyon / ofis / kalite). Denetçi Ofis QR'ını okuttuğunda
-- ofis soruları, Üretim QR'ını okuttuğunda üretim soruları açılır.
-- Alan elle seçildiğinde de o alanın bölümüne tanımlı form yüklenir.
--
-- Boş (NULL) bırakılan şablonlar eskisi gibi davranır: yalnızca
-- "varsayılan" işaretlenirse kullanılırlar.
-- ============================================================

ALTER TABLE s5_form_templates
  ADD COLUMN IF NOT EXISTS form_tipi text;

-- Aynı tipe iki şablon bağlanamaz; hangisinin geçerli olduğu belirsiz kalmasın.
CREATE UNIQUE INDEX IF NOT EXISTS s5_form_templates_tek_tip
  ON s5_form_templates (form_tipi)
  WHERE form_tipi IS NOT NULL;

-- Yalnızca tanımlı tipler yazılabilsin.
DO $$
BEGIN
  ALTER TABLE s5_form_templates
    ADD CONSTRAINT s5_form_templates_tip_gecerli
    CHECK (form_tipi IS NULL OR form_tipi IN ('uretim','operasyon','ofis','kalite'));
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- kısıt zaten var
END $$;

SELECT id, adi, form_tipi, aktif FROM s5_form_templates ORDER BY adi;
