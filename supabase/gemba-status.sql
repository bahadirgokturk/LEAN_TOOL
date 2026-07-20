-- ============================================================
-- GEMBA — Bulgu durumu (Yapıldı / Yapılmadı) + duruma göre silme kuralı
-- Saueressig Türkiye · OPEX
--
-- KULLANIM: Bu dosyanın TAMAMINI *Gemba'nın* Supabase projesinde
-- (xeettwmxooxtwxzevitk) SQL Editor'e yapıştırıp Run edin.
-- Tekrar çalıştırmak güvenlidir (idempotent), mevcut veriler silinmez.
--
-- ÖNKOŞUL: cleanup.sql'deki ADIM 0 (vault'a gemba_service_key kaydı) daha
-- önce yapılmış olmalı — bu dosya o anahtarı kullanmaya devam eder.
-- ============================================================

-- 1) DURUM KOLONLARI
-- status:  NULL = Beklemede (henüz değerlendirilmedi)
--          'yapildi'   = İş tamamlandı  → 2 gün sonra silinir
--          'yapilmadi' = Hâlâ açık      → HİÇ silinmez (korumalı)
alter table gemba_findings add column if not exists status text;
alter table gemba_findings drop constraint if exists gemba_findings_status_check;
alter table gemba_findings add constraint gemba_findings_status_check
  check (status is null or status in ('yapildi','yapilmadi'));

-- Durumun ne zaman işaretlendiği — "yapıldı" için 2 günlük sayaç buradan başlar
-- (kaydın oluşturulma tarihinden değil).
alter table gemba_findings add column if not exists status_changed_at timestamptz;

create index if not exists idx_gemba_findings_status on gemba_findings(status);

-- 2) TEMİZLİK FONKSİYONU — duruma duyarlı hale getirildi
--
-- Silme kuralları:
--   • status = 'yapilmadi'  → asla silinmez (açık iş kaybolmasın)
--   • status = 'yapildi'    → işaretlendikten 2 gün sonra silinir
--   • status = NULL         → oluşturulmasından 7 gün sonra silinir (eski davranış)
create or replace function gemba_cleanup_old_findings()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  rec record;
  storage_path text;
  service_key text;
  project_url text := 'https://xeettwmxooxtwxzevitk.supabase.co';
begin
  select decrypted_secret into service_key
  from vault.decrypted_secrets
  where name = 'gemba_service_key'
  order by created_at desc
  limit 1;

  if service_key is null then
    raise notice 'gemba_service_key Vault''da bulunamadı, temizlik atlandı.';
    return;
  end if;

  for rec in
    select id, photo_url
    from gemba_findings
    where
      -- Tamamlanan bulgular: işaretlemeden 2 gün sonra
      (status = 'yapildi'
        and coalesce(status_changed_at, created_at) < now() - interval '2 days')
      -- Değerlendirilmemiş bulgular: eski 7 günlük kural
      or (status is null and created_at < now() - interval '7 days')
      -- 'yapilmadi' bilinçli olarak burada YOK — korumalıdır.
  loop
    storage_path := split_part(rec.photo_url, '/gemba-photos/', 2);

    if storage_path is not null and storage_path <> '' then
      perform net.http_delete(
        url := project_url || '/storage/v1/object/gemba-photos/' || storage_path,
        headers := jsonb_build_object(
          'apikey', service_key,
          'Authorization', 'Bearer ' || service_key
        )
      );
    end if;

    delete from gemba_findings where id = rec.id;
  end loop;
end;
$$;

-- 3) ZAMANLAMA — her gün 03:00 UTC (mevcut job korunur, sadece fonksiyon güncellendi)
select cron.unschedule('gemba-cleanup-old-findings')
where exists (select 1 from cron.job where jobname = 'gemba-cleanup-old-findings');

select cron.schedule(
  'gemba-cleanup-old-findings',
  '0 3 * * *',
  $$ select gemba_cleanup_old_findings(); $$
);

-- ============================================================
-- TEST (opsiyonel)
--   select gemba_cleanup_old_findings();
-- Silinecek kayıt yoksa sessizce biter — normaldir.
-- ============================================================
