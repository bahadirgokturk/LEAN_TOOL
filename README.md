# OPEX Lean Tool — Hub

Saueressig Türkiye OPEX modüllerine giriş kapısı (Tier 0: link-out mimarisi — backend/auth yok, her kart ilgili uygulamanın kendi login ekranına yönlendirir).

**Canlı adres:** https://bahadirgokturk.github.io/LEAN_TOOL/

## Modül linklerini güncelleme

Tüm URL'ler [src/app/page.tsx](src/app/page.tsx) dosyasının en üstünde. `null` olanlar "URL bekleniyor" olarak görünür; deploy sonrası gerçek linki yaz, push'la — GitHub Actions otomatik yayınlar.

## Geliştirme

```bash
npm install
npm run dev   # http://localhost:3000
```

> Faz 2: ortak Supabase Auth projesiyle SSO — şimdilik yapılmadı.

## Dağıtım sırası (ÖNEMLİ)

Kod her push'ta Vercel'e otomatik gider; `supabase/` altındaki SQL dosyaları
**gitmez, elle çalıştırılır**. Sıra ters olursa yeni kolonu kullanan işlem
"Sunucu hatası" verir — 5S denetimlerinin kaydedilmemesinin nedeni buydu.

1. Önce SQL: değişen/yeni `supabase/*.sql` dosyasını Supabase SQL Editor'de çalıştır.
   Hepsini tek seferde tamamlamak için: [supabase/s5-eksik-kolonlar.sql](supabase/s5-eksik-kolonlar.sql)
   (tekrar çalıştırılabilir, veri silmez).
2. Sonra push (Vercel dağıtımı).

Kontrol: yönetici olarak 5S'e girdiğinde eksik kolon varsa ekranın altında
kırmızı uyarı çubuğu çıkar. Uç nokta: `GET /api/s5/health/schema`.

## Silinen denetimi geri alma

Denetim silmek artık kaydı yok etmez; `status='iptal'` yaparak arşive alır.
Arşivdekileri listelemek: `GET /api/s5/audits?status=iptal` (yönetici).
Geri almak için Supabase SQL Editor'de:

```sql
UPDATE s5_audits SET status='tamamlandi' WHERE id = 'DENETIM_ID';
```

Bu projede Supabase Free plan kullanılıyor; **otomatik yedek (PITR) yok**.
Kalıcı silinen bir kayıt geri getirilemez — arşivleme bu yüzden var.

## Denetim hangi soruları açar?

Öncelik sırası (ilk eşleşen kazanır):

1. Yarıda kalan taslağın formu — cevaplar o sorulara ait olduğu için değiştirilmez.
2. Yöneticinin atamada seçtiği form — denetçi değiştiremez.
3. QR'ın form tipi — `?form=uretim|operasyon|ofis|kalite`.
4. Seçilen alanın bölümü — üretim alanı seçilince üretim formu yüklenir.
5. "Varsayılan" işaretli şablon, o da yoksa yerleşik 5S formu.

Şablonu bir tipe bağlamak: **Form Şablonları** ekranında kartın üzerindeki
"Bölüm/QR tipi" listesinden seçin. Bir tipe yalnızca bir şablon bağlanabilir.
Bunun için `supabase/s5-form-tipi.sql` çalıştırılmış olmalıdır; çalıştırılmadan
önce sistem eskisi gibi tek varsayılan formla çalışır (hata vermez).

3. ve 4. adımlarda cevaplanmış soru varsa form **değiştirilmez** — soru seti
değişirse cevaplar yanlış sorulara kayacağı için.
