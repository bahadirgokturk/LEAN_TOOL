# Yalın Tool — Tam Ürün Strix Güvenlik ve Düzeltme Raporu

**Tarih:** 10 Ağustos 2026  
**Dal:** `staging/strix-security-scan`  
**Strix koşusu:** `lean-tool_b362`  
**Kapsam:** Proje Yönetimi, Gemba, 5S, AI, bildirim, dosya/Storage,
kimlik doğrulama, bağımlılık ve yapılandırma  
**Maliyet:** `$0.00` — ChatGPT abonelik oturumu

## Sonuç

İki Strix turunda toplam yedi doğrulanmış bulgu elde edildi:

- Yüksek: 2
- Orta: 4
- Düşük: 1
- Kritik: 0

Yedi bulgunun tamamı staging kaynak kodunda giderildi ve regresyon kontrolleri
eklendi. Gemba sunucu tarafı düzeltmesinin canlıda etkin olması için
`supabase/gemba-admin-security.sql` dosyasının Supabase üzerinde uygulanması ve
gerçek yöneticilere `gemba_admin` app_metadata rolünün atanması gerekir. Bu SQL
uygulanmadan Gemba bulgusu canlı ortam için kapalı kabul edilmemelidir.

## Bulgular ve durumları

| No | Seviye | Modül | Bulgu | Staging durumu |
|---|---|---|---|---|
| 1 | Yüksek / CVSS 8.1 | Proje Yönetimi | JSON içe aktarmadaki grup rengiyle kalıcı SVG XSS | Düzeltildi |
| 2 | Yüksek / CVSS 8.1 | Gemba | Admin ekranında admin rol kontrolü yok | Kod + RLS SQL hazır; SQL uygulanmalı |
| 3 | Orta / CVSS 4.3 | 5S | Özel fotoğraflarda fabrika/bölüm BOLA | Düzeltildi |
| 4 | Orta / CVSS 4.3 | 5S | Alan detayında IDOR | Düzeltildi |
| 5 | Orta / CVSS 4.3 | 5S | Denetim planlarında kapsam atlama | Düzeltildi |
| 6 | Orta / CVSS 4.3 | 5S | Denetim detayında bölümler arası erişim | Düzeltildi |
| 7 | Düşük / CVSS 3.5 | Bildirim | İstek origin/Host değerinin e-posta linkine taşınması | Düzeltildi |

## Uygulanan düzeltmeler

### Proje Yönetimi kalıcı XSS

- Grup renkleri yalnız altı haneli hex renk biçimine izin veren
  `normalizeGroupColor` üzerinden kaydediliyor.
- Güncelleme ve JSON içe aktarma aynı merkezi doğrulamayı kullanıyor.
- SVG render sınırında ikinci bir doğrulama uygulanıyor.

### Gemba admin yetkilendirmesi

- Admin arayüzü yalnız Supabase tarafından yönetilen `app_metadata` içinde
  `gemba_admin` rolü olan oturumları kabul ediyor.
- Oturum yenileme, normal giriş ve parola kurtarma akışlarının tamamı aynı
  fail-closed kontrolü kullanıyor.
- SQL dosyası eski gevşek Gemba tablo politikalarını kaldırıp anonim bulgu
  gönderimini korurken okuma/değiştirme/silme işlemlerini admin rolüne bağlıyor.
- Gemba Storage değişiklik ve silme işlemleri de admin rolüne bağlanıyor.

### 5S nesne kapsamı

- Alan detayı, listeyle aynı fabrika ve bölüm koşullarını kullanıyor.
- Plan listesi alan tablosuna bağlanıp rol/fabrika/bölüm kapsamıyla filtreleniyor.
- Denetim detayı aynı fabrika içindeki farklı bölümü artık reddediyor.
- Fotoğraf endpoint'i Storage yolunu indirmeden önce bu yolun kullanıcının
  görebildiği bir denetimin `photos_json` kaydında bulunduğunu doğruluyor.

### Bildirim linki

- E-posta linkleri artık saldırganın etkileyebildiği request origin değerinden
  üretilmiyor.
- `APP_ORIGIN` veya `NEXT_PUBLIC_SITE_URL` ile tanımlanan HTTPS canonical adres
  kullanılıyor; yalnız localhost geliştirmesinde HTTP kabul ediliyor.

## Doğrulama

- Vitest: 12 test dosyası, 73/73 test başarılı
- TypeScript: başarılı
- ESLint: başarılı
- Next.js üretim build'i: başarılı
- Önceki üretim bağımlılık denetimi: 72 bağımlılık, 0 bilinen açık
- Strix tam ürün taraması: 2 yüksek + 1 düşük yeni bulgu
- Strix önceki 5S taraması: 4 orta bulgu

## Dağıtım öncesi zorunlu adımlar

1. İzole staging Supabase ortamı oluşturun.
2. Gerçek Gemba yöneticisine `gemba_admin` app_metadata rolünü atayın.
3. `supabase/gemba-admin-security.sql` dosyasını önce staging'de çalıştırın.
4. Anonim Gemba gönderimi ile admin okuma/düzenleme/silme senaryolarını test edin.
5. Vercel'de `APP_ORIGIN` değerini canonical HTTPS adresine ayarlayın.
6. Strix'i izole staging URL + kaynak kod hedefiyle yeniden çalıştırın.
7. Sonuçlar temizlenmeden staging dalını `main` ile birleştirmeyin.

