-- 5S Form Sablonlari: "aktif" form destegi
-- ------------------------------------------------------------
-- Denetimlerin hangi soru setini kullanacagini belirler.
--
-- Form secimi admin'in kontrolundedir:
--   1. Admin denetimi atarken bir sablon secerse, denetci o formu gorur ve
--      degistiremez (s5_audit_plans.form_template_id).
--   2. Atamasiz baslatilan denetimlerde (QR, serbest denetim) burada aktif
--      isaretlenen sablon kullanilir.
--   3. Hicbiri yoksa uygulamayla gelen yerlesik 5S formu kullanilir.
--
-- Ayni anda yalnizca bir sablon aktif olabilir.
-- Supabase SQL Editor'da bir kez calistirin (tekrar calistirilabilir).

ALTER TABLE s5_form_templates
  ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT false;

-- En fazla bir aktif sablon olmasini veritabani duzeyinde garanti eder.
CREATE UNIQUE INDEX IF NOT EXISTS s5_form_templates_tek_aktif
  ON s5_form_templates (aktif)
  WHERE aktif = true;

-- Denetimin hangi soru setiyle doldruldugu. Denetim sonradan duzenlenirken
-- ayni formla acilir; aktif form o sirada degismis olsa bile cevaplar kaymaz.
-- Bos ise yerlesik 5S formu varsayilir (bu kolondan onceki denetimler).
ALTER TABLE s5_audits
  ADD COLUMN IF NOT EXISTS form_template_id text;
