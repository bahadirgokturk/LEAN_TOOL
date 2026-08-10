# Yalın Tool — Strix Staging Güvenlik Tarama Raporu

**Tarih:** 10 Ağustos 2026  
**Dal:** `staging/strix-security-scan`  
**İncelenen commit:** `9bf257d3cd89756413c36fa120caddcab286495d`  
**Strix:** 1.5.2, quick scan, yerel kaynak kod, white-box  
**Model/oturum:** `chatgpt/gpt-5.4`, ChatGPT abonelik oturumu  
**Strix maliyet göstergesi:** `0.0`  

## Yönetici özeti

Strix taraması dört adet **orta seviye** yetkilendirme açığını raporladı. Dört
bulgu da kaynak kod üzerinde ayrıca elle doğrulandı. Kritik veya yüksek seviye
bulgu raporlanmadı. Üretim bağımlılık denetiminde bilinen güvenlik açığı
bulunmadı; kalite kapısı ve üretim build'i başarıyla tamamlandı.

Bu sonuç "güvenlik açığı yüzde sıfır" anlamına gelmez. Kaynak kod taraması,
yalnız incelenen sürüm ve kapsanan kod yolları için güvence sağlar. Vercel
Preview dağıtımına dinamik saldırı yapılmadı; Preview ortamının üretim Supabase
verilerinden ayrıldığı doğrulanmadan bu test güvenli değildir.

## Doğrulanmış bulgular

| No | Seviye | CWE / CVSS | Etkilenen uç | Sonuç |
|---|---|---|---|---|
| STRIX-01 | Orta | CWE-639 / 4.3 | `GET /api/s5/photos` | Başka fabrika veya bölüme ait özel 5S fotoğrafı okunabilir |
| STRIX-02 | Orta | CWE-639 / 4.3 | `GET /api/s5/areas/[id]` | Kimliği bilinen başka fabrika/bölüm alan kaydı okunabilir |
| STRIX-03 | Orta | CWE-863 / 4.3 | `GET /api/s5/audits/plans/list` | Bölüm gibi kapsamlı roller kendi kapsamı dışındaki planları listeleyebilir |
| STRIX-04 | Orta | CWE-639 / 4.3 | `GET /api/s5/audits/[id]` | Aynı fabrikadaki başka bölümün denetim detayı okunabilir |

### STRIX-01 — Özel 5S fotoğraflarında nesne düzeyi yetkilendirme eksikliği

**Kod:** `src/app/api/s5/photos/route.ts:55`  
**Destekleyen kod:** `src/lib/s5/route.ts:26`, `src/lib/s5/auth.ts:105`

`GET` işleyicisi `protectedRoute({})` ile yalnız geçerli bir oturum arıyor.
İstemcinin verdiği `path` biçimsel olarak doğrulandıktan sonra dosya,
`SUPABASE_SERVICE_ROLE_KEY` kullanılarak özel Storage alanından getiriliyor.
İstenen yolun kullanıcının görebildiği bir denetime, fabrikaya veya bölüme ait
olduğu kontrol edilmiyor.

**Öneri:** İstemciden doğrudan Storage yolu almak yerine fotoğraf kimliği alın;
sunucuda fotoğrafı denetim kaydına bağlayın ve tam fabrika/bölüm/denetim
yetkisini doğruladıktan sonra dosyayı döndürün.

### STRIX-02 — Alan detayında fabrika/bölüm IDOR

**Kod:** `src/app/api/s5/areas/[id]/route.ts:8`  
**Karşılaştırma:** `src/app/api/s5/areas/route.ts:14`

Alan listesi kapsam filtresi uygularken detay uç noktası `id` ile doğrudan
`SELECT * FROM s5_areas WHERE id = $1` çalıştırıyor ve yalnız oturum
gerektiriyor. Kapsamlı bir kullanıcı, kimliğini bildiği yabancı alanı okuyabilir.

**Öneri:** Detay sorgusuna liste uç noktasıyla aynı fabrika ve gerekiyorsa bölüm
koşullarını ekleyin; kapsam dışı kayıt için bilgi sızdırmayan `404` davranışı
tercih edin.

### STRIX-03 — Denetim planı listesinde kapsam atlama

**Kod:** `src/app/api/s5/audits/plans/list/route.ts:7`

Uç nokta yalnız `denetci` rolünde `auditor_id` filtresi ekliyor. `departman` ve
`takimlider` gibi kapsamlı roller için fabrika/bölüm koşulu bulunmadığından tüm
plan satırları dönebiliyor.

**Öneri:** Planları alan tablosuyla ilişkilendirip ortak kapsam yardımcısını
uygulayın. Rol bazlı tüm dallar fail-closed olmalı.

### STRIX-04 — Denetim detayında bölümler arası erişim

**Kod:** `src/app/api/s5/audits/[id]/route.ts:16`, `:73`  
**Destekleyen kod:** `src/lib/s5/sql.ts:47`

Liste yolu `applyAuditVisibility` ile fabrika ve bölüm filtresi uyguluyor.
Detay yolundaki `assertCanAccess` ise kapsamlı rollerde yalnız fabrikanın eşit
olduğunu kontrol ediyor. Bu nedenle aynı fabrikada farklı bölüme ait denetim,
kimliği biliniyorsa okunabiliyor.

**Öneri:** Detay kontrolünü listeyle aynı merkezi kapsam kuralına bağlayın;
`departman` ve `takimlider` için hem fabrika hem bölüm eşleşmesini test edin.

## Doğrulama sonuçları

- `npm run quality`: başarılı
  - Vitest: 9 test dosyası, 65/65 test geçti
  - TypeScript (`tsc --noEmit`): geçti
  - ESLint (`eslint src`): geçti
- `npm run build`: başarılı; Next.js 16.3.0 üretim build'i tamamlandı
- `npm audit --omit=dev`: 72 üretim bağımlılığı, 0 bilinen açık
- Vercel Preview: `staging/strix-security-scan` dağıtımı `READY`
- Strix SARIF: 4 doğrulanmış bulgu

Build sırasında `@supabase/supabase-js`, Node.js 20 desteğinin gelecekte
kaldırılacağı uyarısını verdi. Bu bir güvenlik açığı değildir; çalışma zamanını
Node.js 22 LTS'e yükseltmek için teknik borç işi açılmalıdır.

## Tarama kısıtları

- Üretim, Vercel Preview, Supabase veya üçüncü taraf altyapıya saldırı
  gönderilmedi.
- Yerel dinamik harness ajanı Windows–Docker `write_stdin`/kapalı boru hatasıyla
  tamamlanamadı. Bulgular statik kod yolu ve yerel mock kanıtlarıyla doğrulandı.
- OneDrive üzerinde eşzamanlı SARIF yazımında geçici dosya kilidi oluştu; nihai
  SARIF dört bulguyla başarıyla korundu.
- Sırlar, oturum belirteçleri, kişisel veriler ve denetim fotoğrafları rapora
  alınmadı.

## Önerilen kapanış sırası

1. Dört yetkilendirme açığını merkezi ve tekrar kullanılabilir kapsam
   yardımcılarıyla düzeltin.
2. Her bulgu için izin verilen ve reddedilen rol/fabrika/bölüm kombinasyonlarını
   kapsayan regresyon testleri ekleyin.
3. Kalite, build ve bağımlılık denetimini yeniden çalıştırın.
4. Üretimden tamamen ayrı Supabase proje/verisi ve ayrı Vercel Preview ortam
   değişkenleri kurun.
5. Yalnız bu izole ortamda Strix dinamik saldırı testi yapın.

