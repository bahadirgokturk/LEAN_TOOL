# Güvenlik Denetimi ve Sertleştirme Raporu

**Proje:** OPEX Lean Tool (Hub + Proje Yönetimi + 5S Denetim + Gemba)
**Denetim tarihi:** 20.07.2026
**Kapsam:** Kimlik doğrulama, yetkilendirme, veri erişimi, girdi doğrulama, gizli anahtar yönetimi, istemci tarafı güvenlik
**Yöntem:** Statik kod analizi + canlı ortamda doğrulama testleri

---

## 1. Yönetici Özeti

Uygulama üzerinde tam kapsamlı bir güvenlik denetimi yapıldı. **4 gerçek bulgu** tespit edildi ve **tamamı giderildi**. Mimari temeller (parametreli sorgular, bcrypt ile şifre saklama, httpOnly çerezler, satır seviyesi güvenlik) denetim öncesinde de sağlamdı.

| Önem | Bulgu | Durum |
|---|---|---|
| 🔴 Kritik | Varsayılan şifreler canlıda geçerliydi | ✅ Giderildi |
| 🟠 Yüksek | Brute-force (kaba kuvvet) koruması yoktu | ✅ Giderildi |
| 🟡 Orta | Şifre karmaşıklık kuralı yoktu | ✅ Giderildi |
| 🟡 Orta | 5S arayüzünde XSS riski | ✅ Giderildi |
| 🔵 Düşük | Güvenlik başlıkları eksikti | ✅ Giderildi |

---

## 2. Bulgular ve Alınan Önlemler

### 2.1 🔴 KRİTİK — Varsayılan şifrelerin canlıda geçerli olması

**Bulgu:** İlk kurulum için oluşturulan varsayılan şifreler (`admin123`, `bah123`, `izm123`, `esb123`) canlı ortamda hâlâ geçerliydi. Bu şifreler kurulum betiğinde (`supabase/s5-schema.sql`) açık şekilde yer aldığı için, repoya erişimi olan herkes yönetici hesabına giriş yapabilirdi.

**Etki:** Yetkisiz yönetici erişimi, tüm denetim verilerinin okunması/silinmesi.

**Alınan önlem:**
- `supabase/s5-security.sql` betiği, varsayılan şifre kullanan tüm hesapların şifresini tahmin edilemez rastgele bir değerle ezer ve hesapları "şifre değiştirmeli" olarak işaretler.
- Kurulum sonrası her hesaba yeni şifre atanması zorunlu hale getirildi.
- Giriş yanıtı `must_change_password` bayrağı döndürerek arayüzde uyarı gösterilmesini sağlar.

**Kalıcı öneri:** Kurulum betiklerine bir daha gerçek şifre yazılmamalı; hesaplar ilk kurulumda şifresiz oluşturulup yönetici tarafından atanmalıdır.

---

### 2.2 🟠 YÜKSEK — Kaba kuvvet (brute-force) saldırısına açıklık

**Bulgu:** `/api/s5/auth/login` ucunda deneme sınırı yoktu. Saldırgan saniyede yüzlerce şifre deneyebilirdi.

**Etki:** Zayıf şifreli hesapların ele geçirilmesi.

**Alınan önlem:** Veritabanı tabanlı hesap kilitleme uygulandı (`src/app/api/s5/auth/login/route.ts`):
- 5 başarısız denemeden sonra hesap **15 dakika** kilitlenir (HTTP 429).
- Sayaç veritabanında tutulur — sunucusuz (serverless) ortamda örnekler arası tutarlıdır; bellekte tutmak yetersiz olurdu.
- Başarılı girişte sayaç sıfırlanır.
- **Kullanıcı adı sızıntısı (user enumeration) engellendi:** Var olmayan kullanıcıda da sahte bir bcrypt karşılaştırması yapılarak yanıt süresi eşitlendi ve aynı hata mesajı döndürülür.

---

### 2.3 🟡 ORTA — Şifre karmaşıklık kuralının bulunmaması

**Bulgu:** Kullanıcı oluşturma/güncelleme uçlarında şifre kuralı yoktu; tek karakterli şifre kabul ediliyordu.

**Alınan önlem:** Merkezî şifre politikası eklendi (`src/lib/s5/auth.ts` → `validatePassword`):
- En az 8 karakter
- En az bir harf **ve** bir rakam
- Yaygın/zayıf şifre listesi reddedilir (`123456`, `admin123`, `password` vb.)
- Kural hem kullanıcı oluşturmada hem şifre değiştirmede uygulanır.

---

### 2.4 🟡 ORTA — 5S arayüzünde depolanmış XSS riski

**Bulgu:** 5S arayüzü eski bir kod tabanıdır; kullanıcı verisi **30+ noktada** `innerHTML` ile sayfaya basılıyor ve HTML kaçışlama (escaping) yapılmıyordu. Bölge adı veya denetim notuna `<script>` yazan bir kullanıcı, o kaydı görüntüleyen diğer kullanıcıların tarayıcısında kod çalıştırabilirdi.

**Etki:** Oturum çalma, yetkisiz işlem yapma (depolanmış XSS).

**Alınan önlem:** Her render noktasını tek tek düzeltmek yerine **tek giriş noktasında sunucu tarafı temizleme** tercih edildi (`sanitizeText` / `sanitizeDeep`):
- Tüm yazma uçlarında (`audits`, `areas`, `actions`, `users`, `forms`) metin alanlarındaki `<` ve `>` karakterleri kaldırılır.
- Denetim notları/cevapları gibi iç içe JSON yapıları da özyinelemeli olarak temizlenir.
- Alan uzunlukları sınırlandırıldı (aşırı veri girişine karşı).
- Kullanıcı adları yalnızca güvenli karakterlere (`a-z 0-9 . _ -`) indirgenir.

**Bu yaklaşımın gerekçesi:** Tehlikeli içerik veritabanına hiç girmediği için, ileride eklenecek yeni bir görüntüleme noktası da otomatik olarak korunmuş olur. Render tarafında kaçışlama yapmak, tek bir noktanın unutulmasıyla açığa yol açardı.

---

### 2.5 🔵 DÜŞÜK — Eksik güvenlik başlıkları

**Alınan önlem** (`next.config.ts`):
- `X-Frame-Options: SAMEORIGIN` — clickjacking koruması
- `X-Content-Type-Options: nosniff` — MIME tipi karıştırma koruması
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` — konum/mikrofon/ödeme API'leri kapatıldı
- `Strict-Transport-Security` zaten platform tarafından sağlanıyor.

---

## 3. Denetimde Sorun Bulunmayan Alanlar

Aşağıdaki kontroller yapıldı ve **açık tespit edilmedi**:

| Kontrol | Sonuç |
|---|---|
| **SQL Enjeksiyonu** | ✅ Tüm sorgular parametreli (`$1, $2...`). Kullanıcı girdisi hiçbir yerde SQL'e birleştirilmiyor. |
| **Gizli anahtar sızıntısı** | ✅ Kod tabanında servis anahtarı/API anahtarı yok; tümü ortam değişkenlerinde. `.env*` dosyaları `.gitignore`'da. |
| **Yetkilendirme** | ✅ Tüm API uçlarında oturum kontrolü (`requireUser`) ve rol kontrolü (`requireRole`) mevcut. Sadece giriş/çıkış uçları açık — beklenen davranış. |
| **Yatay yetki aşımı** | ✅ Denetçi yalnızca kendi denetimlerini, departman kullanıcısı yalnızca kendi fabrikasını görebiliyor (sorgu seviyesinde kısıt). |
| **Şifre saklama** | ✅ bcrypt (maliyet faktörü 10), düz metin şifre saklanmıyor. |
| **Oturum yönetimi** | ✅ `httpOnly` + `secure` + `sameSite=lax` çerez, 8 saatlik geçerlilik. |
| **Veritabanı erişimi** | ✅ Satır seviyesi güvenlik (RLS) açık; 5S tablolarına yalnızca sunucu tarafından erişiliyor. |
| **Aktarım güvenliği** | ✅ HTTPS zorunlu (HSTS, preload). |

---

## 4. Bilinen Sınırlar ve Sonraki Adımlar

Aşağıdakiler mevcut haliyle **kabul edilebilir risk** seviyesindedir; iyileştirme sırası önem sırasına göredir.

1. **Content-Security-Policy (CSP) eklenmesi**
   5S ve Gemba eski kod tabanları inline script kullandığı için katı CSP şu an uygulanamıyor. Bu modüller modernize edildikçe CSP eklenmelidir. *(Etki: XSS'e karşı ikinci savunma katmanı)*

2. **Fotoğraf yükleme kovası izinleri**
   5S fotoğrafları anonim anahtarla yükleniyor (5S kendi JWT'sini kullandığı, Supabase Auth kullanmadığı için). İdeal çözüm: sunucudan **imzalı yükleme URL'i** üretmek. *(Etki: kovaya yetkisiz dosya yüklenmesi — maliyet/kötüye kullanım riski)*

3. **Denetim izi (audit log)**
   Kritik işlemler (kullanıcı silme, denetim silme, rol değiştirme) şu an loglanmıyor. Kim ne zaman ne yaptı sorusunun cevaplanabilmesi için eklenmelidir.

4. **Merkezî oturum sonlandırma (SSO)**
   Şu an her modülün ayrı girişi var. Ortak kimlik doğrulamaya (Faz C) geçilmesi hem kullanıcı deneyimi hem güvenlik yönetimi açısından iyileştirme sağlar.

---

## 5. Sürüm Notu

Bu rapordaki tüm düzeltmeler tek bir sürümde uygulanmıştır. Uygulanması gereken veritabanı betikleri:

```
supabase/s5-security.sql   → hesap kilitleme alanları + varsayılan şifrelerin iptali
supabase/s5-storage.sql    → fotoğraf kovası ve erişim politikaları
```

**Kurulum sonrası zorunlu adım:** `s5-security.sql` içindeki ADIM 3 uygulanarak her hesaba güçlü şifre atanmalıdır. Atanana kadar hesaplar giriş yapamaz.
