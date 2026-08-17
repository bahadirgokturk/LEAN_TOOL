-- 5S Form Şablonları: "aktif" form desteği
-- ------------------------------------------------------------
-- Denetimlerin hangi soru setini kullanacağını belirleyen tek bir "aktif"
-- şablonu işaretlemeyi sağlar. Aynı anda yalnızca bir şablon aktif olabilir;
-- hiçbiri aktif değilse uygulama yerleşik varsayılan 5S formunu kullanır.
--
-- Supabase SQL Editor'da bir kez çalıştırın (idempotent).

ALTER TABLE s5_form_templates
  ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT false;

-- En fazla bir aktif şablon olmasını veritabanı düzeyinde garanti eder.
CREATE UNIQUE INDEX IF NOT EXISTS s5_form_templates_tek_aktif
  ON s5_form_templates (aktif)
  WHERE aktif = true;
