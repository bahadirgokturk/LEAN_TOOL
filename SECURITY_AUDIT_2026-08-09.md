# Güvenlik Doğrulama Raporu — 9 Ağustos 2026

## Sonuç

Bu rapor, statik inceleme ve otomatik kontrollerde doğrulanabilen güvenlik
durumunu gösterir. “Mutlak sıfır açık” garantisi vermez; bilinmeyen açıklar ancak
bağımsız sızma testi, çalışma zamanı gözlemi ve düzenli tekrar denetimleriyle
azaltılabilir.

| Ölçüm | Sonuç |
| --- | --- |
| Bilinen üretim bağımlılığı açığı | 0 |
| Doğrulanmış kritik bulgu | 0 açık |
| Doğrulanmış yüksek bulgu | 0 açık |
| Güvenlik/rol/oturum testleri dahil toplam test | 63 / 63 geçti |
| TypeScript ve ESLint | Geçti |
| Üretim derlemesi | Geçti |
| Ölçülen kopya kod bölgesi | 0 |

## Bu turda kapatılan riskler

1. `s5-photos` kovasına anonim dosya yükleme kaldırıldı.
2. Fotoğraf yükleme yalnızca 5S `admin` ve `denetci` oturumlarına açıldı.
3. Dosya boyutu 3 MB; içerik türü JPEG, PNG veya WebP ile sınırlandı.
4. MIME başlığına ek olarak dosya imzası kontrolü eklendi.
5. Fotoğraf kovası özel yapıldı; fotoğraflar yalnızca 5S oturumuyla okunuyor.
6. Supabase service-role anahtarı yalnızca sunucu ortam değişkeninde kullanılıyor.
7. Eski açık fotoğraf URL'lerini korumalı uygulama URL'lerine dönüştüren göç eklendi.
8. 5S JWT değeri login JSON gövdesinden kaldırıldı ve yalnızca güvenli `httpOnly`
   çerezde tutuldu.
9. Bildirim alıcı sayısı 50 ile sınırlandı ve tekrar eden alıcılar teke indirildi.
10. AI sağlayıcı çağrısına 60 saniye zaman aşımı eklendi; ham sağlayıcı hata
    mesajlarının istemciye sızması engellendi.
11. HSTS, Cross-Origin-Opener-Policy ve ek tarayıcı güvenlik başlıkları eklendi.
12. Üretim bağımlılığı güvenlik denetimi CI için zorunlu hale getirildi.
13. AI ve bildirim uçlarına atomik, kullanıcı bazlı Supabase rate limit eklendi;
    sayaç sunucusuz instance değişimlerinde sıfırlanmaz ve hata halinde fail-closed
    davranır.

## Kalan kabul edilmiş riskler

- Eski 5S/Gemba arayüzleri inline script ve `innerHTML` kullandığı için katı CSP
  henüz uygulanamıyor. Sunucu tarafı temizleme mevcut olsa da CSP ikinci savunma
  katmanı olarak modernizasyon sonrasında eklenmelidir.
- AI ve bildirim uçlarında kullanıcı bazlı kalıcı rate limit vardır. Kimliksiz
  trafik için dağıtım katmanında ayrıca IP bazlı koruma uygulanabilir.
- Kritik silme/rol değiştirme işlemleri için kalıcı güvenlik denetim izi henüz
  tamamlanmamıştır.
- Bu çalışma kaynak kod ve bağımlılık denetimidir; bağımsız DAST/sızma testi
  yerine geçmez.

## Canlıya alma şartları

1. `SUPABASE_SERVICE_ROLE_KEY` yalnızca sunucu ortamında tanımlanmalıdır.
2. Güncel `supabase/s5-storage.sql` canlı Supabase projesinde uygulanmalıdır.
3. `supabase/api-rate-limits.sql` canlı Supabase projesinde uygulanmalıdır.
4. Yerel, CI ve dağıtım ortamları Node.js 22 kullanmalıdır.
5. `npm run quality`, `npm run build` ve üretim bağımlılığı denetimi geçmeden
   sürüm yayınlanmamalıdır.
