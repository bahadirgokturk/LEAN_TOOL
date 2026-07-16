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
