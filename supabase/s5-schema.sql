-- ============================================================
-- 5S Denetim Sistemi — Supabase Postgres şeması (s5_ önekli)
-- Saueressig Türkiye · OPEX — LEAN_TOOL monoliti, Faz B
--
-- KULLANIM: Supabase Dashboard → SQL Editor → bu dosyanın tamamını
-- yapıştır → Run. Tekrar çalıştırmak güvenlidir (IF NOT EXISTS / ON CONFLICT).
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tablolar ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS s5_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(64) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(128) NOT NULL,
  role          VARCHAR(32) NOT NULL CHECK (role IN ('admin','denetci','departman','takimlider')),
  dept          VARCHAR(128) DEFAULT '',
  fabrika       VARCHAR(128) DEFAULT '',
  bolum         VARCHAR(128) DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s5_areas (
  id          VARCHAR(64) PRIMARY KEY,
  name        VARCHAR(128) NOT NULL,
  dept        VARCHAR(128) DEFAULT '',
  alt_dept    VARCHAR(128) DEFAULT '',
  fabrika     VARCHAR(128) DEFAULT '',
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s5_audits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id       VARCHAR(64) REFERENCES s5_areas(id) ON DELETE SET NULL,
  area_name     VARCHAR(128) DEFAULT '',
  auditor_id    UUID REFERENCES s5_users(id) ON DELETE SET NULL,
  auditor_name  VARCHAR(128) DEFAULT '',
  date          DATE NOT NULL,
  shift         VARCHAR(16) DEFAULT '',
  total_score   INTEGER DEFAULT 0,
  pillars_json  JSONB DEFAULT '{}',
  answers_json  JSONB DEFAULT '{}',
  notes_json    JSONB DEFAULT '{}',
  photos_json   JSONB DEFAULT '{}',
  status        VARCHAR(32) DEFAULT 'tamamlandi' CHECK (status IN ('tamamlandi','taslak','iptal')),
  form_code     VARCHAR(64) DEFAULT '',
  location      VARCHAR(128) DEFAULT '',
  team_leader   VARCHAR(128) DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s5_actions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id     UUID REFERENCES s5_audits(id) ON DELETE SET NULL,
  area_id      VARCHAR(64) REFERENCES s5_areas(id) ON DELETE SET NULL,
  area_name    VARCHAR(128) DEFAULT '',
  description  TEXT NOT NULL,
  assigned_to  VARCHAR(128) DEFAULT '',
  due_date     DATE,
  status       VARCHAR(32) DEFAULT 'Açık' CHECK (status IN ('Açık','Devam Ediyor','Tamamlandı','İptal')),
  priority     VARCHAR(16) DEFAULT 'Orta' CHECK (priority IN ('Düşük','Orta','Yüksek','Kritik')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s5_audit_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id            VARCHAR(64) REFERENCES s5_areas(id) ON DELETE CASCADE,
  area_name          VARCHAR(128) DEFAULT '',
  auditor_id         UUID REFERENCES s5_users(id) ON DELETE CASCADE,
  auditor_name       VARCHAR(128) DEFAULT '',
  planned_date       DATE NOT NULL,
  shift              VARCHAR(16) DEFAULT '',
  status             VARCHAR(32) DEFAULT 'Bekliyor' CHECK (status IN ('Bekliyor','Devam Ediyor','Tamamlandı','İptal')),
  form_template_id   VARCHAR(64) DEFAULT 'default',
  completed_audit_id UUID REFERENCES s5_audits(id) ON DELETE SET NULL,
  created_by         UUID REFERENCES s5_users(id) ON DELETE SET NULL,
  notes              TEXT DEFAULT '',
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS s5_form_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adi         VARCHAR(128) NOT NULL,
  aciklama    TEXT DEFAULT '',
  pillarlar   JSONB DEFAULT '[]',
  created_by  UUID REFERENCES s5_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── İndeksler ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_s5_audits_area_id    ON s5_audits(area_id);
CREATE INDEX IF NOT EXISTS idx_s5_audits_auditor_id ON s5_audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_s5_audits_date       ON s5_audits(date DESC);
CREATE INDEX IF NOT EXISTS idx_s5_audits_status     ON s5_audits(status);
CREATE INDEX IF NOT EXISTS idx_s5_actions_audit_id  ON s5_actions(audit_id);
CREATE INDEX IF NOT EXISTS idx_s5_actions_status    ON s5_actions(status);
CREATE INDEX IF NOT EXISTS idx_s5_plans_auditor_id  ON s5_audit_plans(auditor_id);
CREATE INDEX IF NOT EXISTS idx_s5_plans_status      ON s5_audit_plans(status);

-- ── updated_at otomatik güncelleme ──────────────────────────
CREATE OR REPLACE FUNCTION s5_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_s5_users_updated_at') THEN
    CREATE TRIGGER trg_s5_users_updated_at   BEFORE UPDATE ON s5_users       FOR EACH ROW EXECUTE FUNCTION s5_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_s5_areas_updated_at') THEN
    CREATE TRIGGER trg_s5_areas_updated_at   BEFORE UPDATE ON s5_areas       FOR EACH ROW EXECUTE FUNCTION s5_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_s5_audits_updated_at') THEN
    CREATE TRIGGER trg_s5_audits_updated_at  BEFORE UPDATE ON s5_audits      FOR EACH ROW EXECUTE FUNCTION s5_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_s5_actions_updated_at') THEN
    CREATE TRIGGER trg_s5_actions_updated_at BEFORE UPDATE ON s5_actions     FOR EACH ROW EXECUTE FUNCTION s5_touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='trg_s5_plans_updated_at') THEN
    CREATE TRIGGER trg_s5_plans_updated_at   BEFORE UPDATE ON s5_audit_plans FOR EACH ROW EXECUTE FUNCTION s5_touch_updated_at();
  END IF;
END $$;

-- ── Güvenlik: RLS aç, policy YOK ─────────────────────────────
-- Bu tablolara yalnızca sunucu tarafı (pooler bağlantısı, tablo sahibi rol)
-- erişir. RLS açık + policy yok = PostgREST/anon key üzerinden erişim kapalı.
ALTER TABLE s5_users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE s5_areas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE s5_audits         ENABLE ROW LEVEL SECURITY;
ALTER TABLE s5_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE s5_audit_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE s5_form_templates ENABLE ROW LEVEL SECURITY;

-- ── Seed: kullanıcılar (ilk şifreler orijinal kurulumla aynı —
--    girişten sonra Admin Paneli'nden değiştirin) ─────────────
INSERT INTO s5_users (username, password_hash, name, role, dept, fabrika, bolum) VALUES
  ('admin',     crypt('admin123', gen_salt('bf', 10)), 'Bahadır Göktürk', 'admin',     '',          '',        ''),
  ('bahadir',   crypt('bah123',   gen_salt('bf', 10)), 'Bahadır Göktürk', 'denetci',   '',          '',        ''),
  ('furkan',    crypt('fur123',   gen_salt('bf', 10)), 'Furkan Lafcı',    'denetci',   '',          '',        ''),
  ('izmir',     crypt('izm123',   gen_salt('bf', 10)), 'İzmir Üretim',    'departman', 'Üretim',    'İzmir',   ''),
  ('operasyon', crypt('ops123',   gen_salt('bf', 10)), 'İzmir Operasyon', 'departman', 'Operasyon', 'İzmir',   ''),
  ('ofis',      crypt('ofi123',   gen_salt('bf', 10)), 'İzmir Ofis',      'departman', 'Ofis',      'İzmir',   ''),
  ('esbas',     crypt('esb123',   gen_salt('bf', 10)), 'Esbaş',           'departman', 'Üretim',    'Esbaş',   ''),
  ('ispak',     crypt('isp123',   gen_salt('bf', 10)), 'İspak',           'departman', 'Üretim',    'İspak',   ''),
  ('karaman',   crypt('kar123',   gen_salt('bf', 10)), 'Karaman',         'departman', 'Üretim',    'Karaman', '')
ON CONFLICT (username) DO NOTHING;

-- ── Seed: bölgeler ───────────────────────────────────────────
INSERT INTO s5_areas (id, name, dept, alt_dept, fabrika) VALUES
  ('iz-t-1', '1. Grup',              'Üretim',    'Tobacco',      'İzmir'),
  ('iz-t-2', '2. Grup',              'Üretim',    'Tobacco',      'İzmir'),
  ('iz-t-3', '3. Grup',              'Üretim',    'Tobacco',      'İzmir'),
  ('iz-t-4', 'Prova',                'Üretim',    'Tobacco',      'İzmir'),
  ('iz-f-1', 'Dekrom',               'Üretim',    'Flexible',     'İzmir'),
  ('iz-f-2', 'CFM',                  'Üretim',    'Flexible',     'İzmir'),
  ('iz-f-3', 'Bakır Kaplama/Finish', 'Üretim',    'Flexible',     'İzmir'),
  ('iz-f-4', 'Lazer/Etching',        'Üretim',    'Flexible',     'İzmir'),
  ('iz-f-5', 'Gravür',               'Üretim',    'Flexible',     'İzmir'),
  ('iz-f-6', 'Krom Kaplama/Finish',  'Üretim',    'Flexible',     'İzmir'),
  ('iz-d-1', 'Polish/Finish',        'Üretim',    'Destek',       'İzmir'),
  ('iz-d-2', 'Otomatik Hat',         'Üretim',    'Destek',       'İzmir'),
  ('iz-d-3', 'Prova (Destek)',       'Üretim',    'Destek',       'İzmir'),
  ('iz-b-1', 'Mekanik Bakım',        'Operasyon', 'Bakım',        'İzmir'),
  ('iz-b-2', 'Elektrik Bakım',       'Operasyon', 'Bakım',        'İzmir'),
  ('iz-p-1', 'Giriş Depo',           'Operasyon', 'Planlama',     'İzmir'),
  ('iz-p-2', 'Sevkiyat',             'Operasyon', 'Planlama',     'İzmir'),
  ('iz-p-3', 'Hammadde Depo',        'Operasyon', 'Planlama',     'İzmir'),
  ('iz-k-1', 'Kalite Kontrol',       'Operasyon', 'Kalite',       'İzmir'),
  ('iz-k-2', 'Kalite Ofisi',         'Operasyon', 'Kalite',       'İzmir'),
  ('iz-o-1', 'OPEX',                 'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-2', 'Üretim Ofisi',         'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-3', 'Planlama',             'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-4', 'İnsan Kaynakları',     'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-5', 'Domestic Satış',       'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-6', 'Tobacco Satış',        'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-7', 'Export Satış',         'Ofis',      'Ofis',         'İzmir'),
  ('iz-o-8', 'Muhasebe',             'Ofis',      'Ofis',         'İzmir'),
  ('es-c-1', 'Kaba Balans',          'Üretim',    'Çelik Üretim', 'Esbaş'),
  ('es-c-2', 'Taşlama',              'Üretim',    'Çelik Üretim', 'Esbaş'),
  ('es-c-3', 'Kaynak Alanı',         'Üretim',    'Çelik Üretim', 'Esbaş'),
  ('es-c-4', 'CNC',                  'Üretim',    'Çelik Üretim', 'Esbaş'),
  ('es-c-5', 'Kalite Kontrol',       'Operasyon', 'Kalite',       'Esbaş'),
  ('is-g-1', 'CFM-Dekrom',           'Üretim',    'Genel Üretim', 'İspak'),
  ('is-g-2', 'Otomatik Hat',         'Üretim',    'Genel Üretim', 'İspak'),
  ('is-g-3', 'Prova',                'Üretim',    'Genel Üretim', 'İspak'),
  ('ka-f-1', 'Dekrom',               'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-2', 'CFM',                  'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-3', 'Bakır Kaplama',        'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-4', 'Polish/Finish',        'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-5', 'Gravür',               'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-6', 'Krom Kaplama/Finish',  'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-f-7', 'Prova',                'Üretim',    'Flex/Tob',     'Karaman'),
  ('ka-c-1', 'Kaba Balans',          'Üretim',    'Çelik Üretim', 'Karaman'),
  ('ka-c-2', 'Taşlama',              'Üretim',    'Çelik Üretim', 'Karaman'),
  ('ka-c-3', 'Kaynak Alanı',         'Üretim',    'Çelik Üretim', 'Karaman'),
  ('ka-c-4', 'CNC',                  'Üretim',    'Çelik Üretim', 'Karaman'),
  ('ka-c-5', 'Freze',                'Üretim',    'Çelik Üretim', 'Karaman'),
  ('ka-c-6', 'Kalite Kontrol',       'Operasyon', 'Kalite',       'Karaman')
ON CONFLICT (id) DO NOTHING;
